const express     = require('express');
const createError = require('http-errors')
const db          = require('../../db');
const auth        = require('../../middleware/sequelize-authorization-middleware');
const config      = require('config');
const merge       = require('merge');
const bruteForce = require('../../middleware/brute-force');
const {Op} = require('sequelize');
const pagination = require('../../middleware/pagination');

const router = express.Router({mergeParams: true});

const userhasModeratorRights = (user) => {
	return user && user.role === 'admin';
}

// basis validaties
// ----------------
router.route('*')

// bestaat de project config
	.all(function(req, res, next) {
		if (!( req.project && req.project.config && req.project.config.votes )) {
			return next(createError(403, 'Project niet gevonden of niet geconfigureerd'));
		}
		return next();
	})

router.route('*')

  // mag er gestemd worden
	.post(function(req, res, next) {
		if (!req.project.isVoteActive()) return next(createError(403, 'Stemmen is gesloten'));
		return next();
	})

  // is er een geldige gebruiker
	.all(function(req, res, next) {
		if (req.method == 'GET') return next(); // nvt

		let hasModeratorRights = userhasModeratorRights(req.user);

		if (!req.user) {
			return next(createError(401, 'Geen gebruiker gevonden'));
		}

		if (req.project.config.votes.requiredUserRole == 'anonymous' && ( req.user.role == 'anonymous' || req.user.role == 'member' || hasModeratorRights )) {
			return next();
		}

		if (req.project.config.votes.requiredUserRole == 'member' && ( req.user.role == 'member' || hasModeratorRights )) {
			return next();
		}

		if (req.project.config.votes.requiredUserRole == 'admin' && ( hasModeratorRights )) {
			return next();
		}

		return next(createError(401, 'Je mag niet stemmen op deze project'));
	})

  // scopes
	.all(function(req, res, next) {

		req.scope = [
			{ method: ['forProjectId', req.project.id]}
    ];

    return next();

  })

// list all votes or all votes
// ---------------------------
router.route('/')

// mag je de stemmen bekijken
	.get(function(req, res, next) {
		let hasModeratorRights = userhasModeratorRights(req.user);

		if (!(req.project.config.votes.isViewable || hasModeratorRights)) {
			return next(createError(403, 'Stemmen zijn niet zichtbaar'));
		}
		return next();
	})
	.get(pagination.init)
	.get(function(req, res, next) {
		let { dbQuery } = req;

		let where = {...dbQuery.where};
		let ideaId = parseInt(req.query.ideaId);
		if (ideaId) {
			where.ideaId = ideaId;
		}
		let userId = parseInt(req.query.userId);
		if (userId) {
			where.userId = userId;
		}
		let opinion = req.query.opinion;

		if (opinion && (opinion == 'yes' || opinion == 'no')) {
			where.opinion = opinion;
		}

		/**
		 * In case of no opinion, it's a bug with the likes, dont send them
		 * @TODO debug in what case this happens.
		 */
		if (req.project.config.votes.voteType === 'likes') {
			where.opinion =  {
      	[Op.ne]: null
    	};
		}

    const order = [];
    if (req.query.sortBy) {
      order.push([
        req.query.sortBy,
        req.query.orderBy || 'ASC'
      ])
    }

		if (req.user && userhasModeratorRights(req.user)) {
			req.scope.push('includeUser');
		}

		db.Vote
			.scope(req.scope)
			.findAndCountAll({ where, order, ...dbQuery })
			.then(function( result ) {
        req.results = result.rows;
        req.dbQuery.count = result.count;
        return next();
			})
			.catch(next);
	})
	.get(pagination.paginateResults)
	.get(function(req, res, next) {
    let records = req.results.records || req.results
		records.forEach((entry, i) => {
			let vote = {
				id: entry.id,
				ideaId: entry.ideaId,
				confirmed: entry.confirmed,
				opinion: entry.opinion,
				createdAt: entry.createdAt
			};

			if (req.user && userhasModeratorRights(req.user)) {
				vote.ip = entry.ip;
				vote.createdAt = entry.createdAt;
				vote.checked =  entry.checked;
				vote.user = entry.user;
				if (vote.user.auth) vote.user.auth.user = req.user;
				vote.userId = entry.userId;
			}
      records[i] = vote
		});
		res.json(req.results);
  });

// create votes
// ------------
router.route('/*')

// heb je al gestemd
	.post(function(req, res, next) {
		db.sequelize.transaction()
			.then(transaction => {
				res.locals.transaction = transaction
				return db.Vote // get existing votes for this user
				.scope(req.scope)
				.findAll({ where: { userId: req.user.id }, transaction, lock: true })
			})
			.then(found => {
				if (req.project.config.votes.voteType !== 'likes' && req.project.config.votes.withExisting == 'error' && found && found.length ) throw createError(403, 'Je hebt al gestemd');
				req.existingVotes = found.map(entry => entry.toJSON());
				return next();
			})
			.catch(err => {
				if (res.locals.transaction) {
					return res.locals.transaction.rollback()
						.then(() => next(err))
						.catch(() => next(err))
				}
				next(err)
			})
	})

// filter body
	.post(function(req, res, next) {
		let votes = req.body || [];
		if (!Array.isArray(votes)) votes = [votes];
		votes = votes.map((entry) => {
			return {
				ideaId: parseInt(entry.ideaId, 10),
				opinion: typeof entry.opinion == 'string' ? entry.opinion : null,
				userId: req.user.id,
				confirmed: false,
				confirmReplacesVoteId: null,
				ip: req.ip,
				checked: null,
			}
		});

    // merge
    if (req.project.config.votes.withExisting == 'merge') {
      // no double votes
      try {
        if (req.existingVotes.find( newVote => votes.find( oldVote => oldVote.ideaId == newVote.ideaId) )) {
			const transaction = res.locals.transaction
			const err = createError(403, 'Je hebt al gestemd')
			if (transaction) {
				return transaction.commit()
					.finally(() => next(err))
			}
			throw err
		}
      } catch (err) {
        return next(err);
      }
      // now merge
      votes = votes
        .concat(
          req.existingVotes
            .map( oldVote => {
              return {
                ideaId: parseInt(oldVote.ideaId, 10),
                opinion: typeof oldVote.opinion == 'string' ? oldVote.opinion : null,
                userId: req.user.id,
                confirmed: false,
                confirmReplacesVoteId: null,
                ip: req.ip,
                checked: null,
              }
              return oldVote
            })
        );
    }

    req.votes = votes;

		return next();
	})

  // validaties: bestaan de ideeen waar je op wilt stemmen
	.post(function(req, res, next) {
		let ids = req.votes.map( entry => entry.ideaId );
		let transaction = res.locals.transaction
		db.Idea
			.findAll({ where: { id:ids, projectId: req.project.id }, transaction, lock: true })
			.then(found => {

				if (req.votes.length != found.length) {
					console.log('req.votes', req.votes);
					console.log('found', found);
					console.log('req.body',req.body);

					return next(createError(400, 'Idee niet gevonden'));
				}
				req.ideas = found;
				return next();
			})
			.catch(err => {
				if (transaction) {
					return transaction.rollback()
						.then(() => next(err))
						.catch(() => next(err))
				}
				next(err)
			})
	})

  // validaties voor voteType=likes
	.post(function(req, res, next) {
		let transaction = res.locals.transaction
		if (req.project.config.votes.voteType != 'likes') return next();

		if (req.project.config.votes.voteType == 'likes' && req.project.config.votes.requiredUserRole == 'anonymous') {
			req.votes.forEach((vote) => {
				// check if votes exists for same opinion on the same IP within 5 minutes
				const whereClause = {
						ip: vote.ip,
			//			opinion : vote.opinion,
						ideaId: vote.ideaId,
						createdAt: {
							[Op.gte]: db.sequelize.literal('NOW() - INTERVAL 5 MINUTE'),
						}
				};

				// Make sure it only blocks new users
				// otherwise the toggle functionality for liking is blocked
				if (req.user) {
					whereClause.userId = {
						[Op.ne] : req.user.id
					};
				}

				// get existing votes for this IP
				db.Vote
					.findAll({ where: whereClause, transaction, lock: true })
					.then(found => {
						if (found && found.length > 0) {
							throw createError(403, 'Je hebt al gestemd');
						}
						return next();
					})
					.catch(err => {
						if (transaction) {
							return transaction.rollback()
								.then(() => next(err))
								.catch(() => next(err))
						}
						next(err)
					})
			});
		} else {
			return next();
		}
	})

  // validaties voor voteType=count
	.post(function(req, res, next) {
		let transaction = res.locals.transaction
		if (req.project.config.votes.voteType != 'count') return next();
		if (req.votes.length >= req.project.config.votes.minIdeas && req.votes.length <= req.project.config.votes.maxIdeas) {
			return next();
		}
		let err = createError(400, 'Aantal ideeen klopt niet');
		if (transaction) {
			return transaction.rollback()
				.then(() => next(err))
				.catch(() => next(err))
		} else {
			return next(err);
		}
	})

  // validaties voor voteType=budgeting
	.post(function(req, res, next) {
		let transaction = res.locals.transaction
		if (req.project.config.votes.voteType != 'budgeting') return next();
		let budget = 0;
		req.votes.forEach((vote) => {
			let idea = req.ideas.find(idea => idea.id == vote.ideaId);
			budget += idea.budget;
		});
		let err;
		if (!( budget >= req.project.config.votes.minBudget && budget <= req.project.config.votes.maxBudget )) {
		  err = createError(400, 'Budget klopt niet');
		}
		if (!( req.votes.length >= req.project.config.votes.minIdeas && req.votes.length <= req.project.config.votes.maxIdeas )) {
		  err = createError(400, 'Aantal ideeen klopt niet');
		}
		if (err) {
			if (transaction) {
				return transaction.rollback()
					.then(() => next(err))
					.catch(() => next(err))
			} else {
				return next(err);
			}
		} else {
			return next();
		}
  })

  // validaties voor voteType=count-per-theme
	.post(function(req, res, next) {
		let transaction = res.locals.transaction
		if (req.project.config.votes.voteType != 'count-per-theme') return next();
    let themes = req.project.config.votes.themes || [];
    let totalNoOfVotes = 0;
    req.votes.forEach((vote) => {
			let idea = req.ideas.find(idea => idea.id == vote.ideaId);
      totalNoOfVotes += idea ? 1 : 0;
      let themename = idea && idea.extraData && idea.extraData.theme;
      let theme = themes.find( theme => theme.value == themename );
      if (theme) {
	      theme.noOf = theme.noOf || 0;
        theme.noOf++;
      }
		});

    let isOk = true;
    themes.forEach((theme) => {
	    theme.noOf = theme.noOf || 0;
		  if (theme.noOf < theme.minIdeas || theme.noOf > theme.maxIdeas) {
        isOk = false;
		  }
    });

		if (( req.project.config.votes.minIdeas && totalNoOfVotes < req.project.config.votes.minIdeas ) || ( req.project.config.votes.maxIdeas && totalNoOfVotes > req.project.config.votes.maxIdeas )) {
      isOk = false;
		}

		if (isOk) {
			return next();
		} else {
			let err = createError(400, 'Count per thema klopt niet');
			if (transaction) {
				return transaction.rollback()
					.then(() => next(err))
					.catch(() => next(err))
			} else {
				return next(err);
			}
		}
	})

  // validaties voor voteType=budgeting-per-theme
	.post(function(req, res, next) {
		let transaction = res.locals.transaction
		if (req.project.config.votes.voteType != 'budgeting-per-theme') return next();
    let themes = req.project.config.votes.themes || [];
		req.votes.forEach((vote) => {
			let idea = req.ideas.find(idea => idea.id == vote.ideaId);
      let themename = idea && idea.extraData && idea.extraData.theme;
      let theme = themes.find( theme => theme.value == themename );
      if (theme) {
	      theme.budget = theme.budget || 0;
        theme.budget += idea.budget;
      }
		});
    let isOk = true;
    themes.forEach((theme) => {
		  if (theme.budget < theme.minBudget || theme.budget > theme.maxBudget) {
        isOk = false;
		  }
  //    console.log(theme.value, theme.budget, theme.minBudget, theme.maxBudget, theme.budget < theme.minBudget || theme.budget > theme.maxBudget);
    });
		if (isOk) {
			return next();
		} else {
			let err = createError(400, 'Budget klopt niet');
			if (transaction) {
				return transaction.rollback()
					.then(() => next(err))
					.catch(() => next(err))
			} else {
				return next(err);
			}
		}
	})

	.post(function(req, res, next) {
		let transaction = res.locals.transaction;
		
		let actions = [];
		switch(req.project.config.votes.voteType) {

			case 'likes':
				req.votes.forEach((vote) => {
					let existingVote =  req.existingVotes ? req.existingVotes.find(entry => entry.ideaId == vote.ideaId) : false;
					if ( existingVote ) {
						if (existingVote.opinion == vote.opinion) {
							actions.push({ action: 'delete', vote: existingVote })
						} else {
							existingVote.opinion = vote.opinion
							actions.push({ action: 'update', vote: existingVote})
						}
					} else {
						actions.push({ action: 'create', vote: vote})
					}
				});
				break;

			case 'count':
			case 'count-per-theme':
			case 'budgeting':
			case 'budgeting-per-theme':
				req.votes.map( vote => actions.push({ action: 'create', vote: vote}) );
				req.existingVotes.map( vote => actions.push({ action: 'delete', vote: vote}) );
				break;

		}

    let promises = [];
    actions.map(action => {
				switch(action.action) {
					case 'create':
						promises.push(db.Vote.create( action.vote, { transaction, lock: true })); // HACK: `upsert` on paranoid deleted row doesn't unset `deletedAt`.
						break;
					case 'update':
						promises.push(db.Vote.update(action.vote, { where: { id: action.vote.id }, transaction, lock: true }));
						break;
					case 'delete':
						promises.push(db.Vote.destroy({ where: { id: action.vote.id }, transaction, lock: true }));
						break;
				}
    });

		Promise
			.all(promises)
      .then(
				result => {
					req.result = result;
					if (transaction) {
						return transaction.commit()
							.finally(() => result)
					}
					return result
				}
			)
			.then(() => {
				return next();
			})
			.catch(err => {
				if (transaction) {
					return transaction.rollback()
						.finally(() => next(err))
				}
				next(err)
			})

	})

	.post(function(req, res, next) {
		let ideaIds = req.votes.map( entry => entry.ideaId );
		db.Vote // get existing votes for this user
			.findAll({ where: { userId: req.user.id, ideaId: ideaIds } })
			.then(found => {
				let result = found.map(entry => { return {
					id: entry.id,
					ideaId: entry.ideaId,
					opinion: entry.opinion,
					userId: entry.userId,
					confirmed: entry.confirmed,
					confirmReplacesVoteId: entry.confirmReplacesVoteId,
				}})
				res.json(result.map(entry => { return {
					id: entry.id,
					ideaId: entry.ideaId,
					userId: entry.userId,
					confirmed: entry.confirmed,
					opinion: entry.opinion,
				}}));
			})
			.catch(next)
	})

	router.route('/:voteId(\\d+)')
		.all(( req, res, next ) => {
			var voteId = req.params.voteId;

			db.Vote
			.findOne({
				where: { id: voteId }
			})
			.then(function( vote ) {
				if( vote ) {
					req.results = vote;
				}
				next();
			})
			.catch(next);
		})
	.delete(auth.useReqUser)
	.delete(function(req, res, next) {
		const vote = req.results;
		if (!( vote && vote.can && vote.can('delete') )) return next( new Error('You cannot delete this vote') );

		vote
			.destroy()
			.then(() => {
				res.json({ "vote": "deleted" });
			})
			.catch(next);
	})

	router.route('/:voteId(\\d+)/toggle')
		.all(( req, res, next ) => {
			var voteId = req.params.voteId;

			db.Vote
			.findOne({
				where: { id: voteId }
			})
			.then(function( vote ) {
				if( vote ) {
					req.vote = vote;
				}
				next();
			})
			.catch(next);
		})
	.all(auth.can('Vote', 'toggle'))
			.get(function( req, res, next ) {
				var ideaId = req.params.ideaId;
				var vote   = req.vote;

				vote.toggle()
					.then(function() {
						res.json({
							id: vote.id,
							ideaId: vote.ideaId,
							userId: vote.userId,
							confirmed: vote.confirmed,
							opinion: vote.opinion,
							ip: vote.ip,
						  createdAt: vote.createdAt,
							checked: vote.checked
						});
					})
					.catch(next);
			});


module.exports = router;
