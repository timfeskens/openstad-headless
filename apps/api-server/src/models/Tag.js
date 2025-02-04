const sanitize = require('../util/sanitize');
const config = require('config');
const getExtraDataConfig = require('../lib/sequelize-authorization/lib/getExtraDataConfig');
const userHasRole = require('../lib/sequelize-authorization/lib/hasRole');
const seqnr = require('./lib/seqnr');

module.exports = function( db, sequelize, DataTypes ) {

	let Tag = sequelize.define('tag', {

		projectId: {
			type         : DataTypes.INTEGER,
			allowNull    : false,
		},

		name: {
			type         : DataTypes.STRING,
			allowNull    : false,
			set          : function( text ) {
				this.setDataValue('name', sanitize.title(text.trim()));
			}
		},

		type: {
			type         : DataTypes.STRING,
			allowNull    : true,
			set          : function( text ) {
				this.setDataValue('type', text?sanitize.safeTags(text.trim()):null);
			}
		},

		seqnr: {
			type         : DataTypes.INTEGER,
			allowNull    : false,
      default: 10,
		},

		extraData: getExtraDataConfig(DataTypes.JSON, 'tags')
	}, {

		defaultScope: {
      order: ['seqnr'],
		},

		hooks: {

      afterCreate: function (instance, options) {
        seqnr.renumber({ model: db.Tag, where: { type: instance.type } });
      },

      afterUpdate: function (instance, options) {
        seqnr.renumber({ model: db.Tag, where: { type: instance.type } });
      },

		},

		individualHooks: true,

	});

	Tag.scopes = function scopes() {

		return {

      forProjectId: function( projectId ) {
        return {
          where: {
            projectId: projectId,
          }
        };
      },

      includeProject: {
        include: [{
          model: db.Project,
        }]
      },

      selectType: function (type) {
        return {
          where: {
            type: type,
          }
        }
      },

		}
	}

	Tag.associate = function( models ) {
		this.belongsToMany(models.Idea, { through: 'idea_tags', constraints: false });
		this.belongsTo(models.Project, { onDelete: 'CASCADE' });
	}

  // dit is hoe het momenteel werkt; ik denk niet dat dat de bedoeling is, maar ik volg nu
	Tag.auth = Tag.prototype.auth = {
    listableBy: 'all',
    viewableBy: 'all',
    createableBy: 'moderator',
    updateableBy: 'moderator',
    deleteableBy: 'moderator',
  }

	return Tag;

}
