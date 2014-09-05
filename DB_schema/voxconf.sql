SET NAMES utf8;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
--  Table structure for `conferences`
-- ----------------------------
DROP TABLE IF EXISTS `conferences`;
CREATE TABLE `conferences` (
  `id` int(11) NOT NULL auto_increment,
  `manager_id` int(11) NOT NULL,
  `access_number` varchar(50) NOT NULL,
  `access_code` varchar(10) NOT NULL,
  `anonymous_access` bit(1) NOT NULL default '\0',
  `callerid_auth` bit(1) NOT NULL default '\0',
  `active` bit(1) NOT NULL default '',
  `ms_url` varchar(100) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id_indx` (`id`),
  KEY `mid_indx` (`manager_id`),
  CONSTRAINT `conference_manager` FOREIGN KEY (`manager_id`) REFERENCES `managers` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;

-- ----------------------------
--  Table structure for `managers`
-- ----------------------------
DROP TABLE IF EXISTS `managers`;
CREATE TABLE `managers` (
  `id` int(11) NOT NULL auto_increment,
  `username` varchar(100) NOT NULL,
  `password` varchar(100) NOT NULL,
  `active` tinyint(1) NOT NULL default '0',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id_indx` (`id`),
  UNIQUE KEY `usr_indx` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;

-- ----------------------------
--  Records of `managers`
-- ----------------------------
BEGIN;
INSERT INTO `managers` VALUES ('1', 'admin', 'd033e22ae348aeb5660fc2140aec35850c4da997', '1');
COMMIT;

-- ----------------------------
--  Table structure for `participants`
-- ----------------------------
DROP TABLE IF EXISTS `participants`;
CREATE TABLE `participants` (
  `id` int(11) NOT NULL auto_increment,
  `conference_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `phone` varchar(50) default NULL,
  `email` varchar(100) default NULL,
  `auto_call` tinyint(4) NOT NULL default '0',
  `passcode` varchar(10) NOT NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id_indx` (`id`),
  KEY `cid_indx` (`conference_id`),
  CONSTRAINT `participant_conference` FOREIGN KEY (`conference_id`) REFERENCES `conferences` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;

SET FOREIGN_KEY_CHECKS = 1;
