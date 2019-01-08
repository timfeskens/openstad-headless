const LoginToken = require('../models').LoginToken;
const User       = require('../models').User;

exports.addUser = ((req, res, next) => {
  const tokenToQuery = req.body.token ?  req.body.token : req.query.token;
  new LoginToken({token: tokenToQuery})
      .query((q) => {
        /**
         * Only select tokens that are younger then 2 days
         * created_at is "bigger then" 48 hours ago
         */

        const days = 2;
        const msForADay = 86400000;
        const date = new Date();
        const timeAgo = new Date(date.setTime(date.getTime() - (days * msForADay)));
        console.log('======> timeAgo',timeAgo);

        q.where('createdAt', '>=', timeAgo);
        q.orderBy('createdAt', 'DESC');
    })
    .fetch()
    .then((token) => {
      console.log('======> token');

      if (token) {
        console.log('======> user id', token.get('userId'));

        new User
          ({id: token.get('userId')})
          .fetch()
          .then((user) => {
            req.userModel = user;
            req.user = user.serialize();
            next();
          })
          .catch((err) => {
            next(err);
          });
      } else {
        console.log('======> No token found.');

        next({
          name: 'LoginTokenNotFound',
          msg: 'No token found.',
          status: 404,
        });
      }
    })
    .catch((err) => {
      console.log('======> err', err);
      next(err);
    });
});
