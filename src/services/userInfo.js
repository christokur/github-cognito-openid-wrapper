const logger = require('../connectors/logger');
const { NumericDate } = require('../helpers');
const githubClient = require('../github');
const config = require('../config');

/**
 * Service for handling user information retrieval and mapping
 */
class UserInfoService {
  /**
   * Maps GitHub user data to OpenID Connect standard claims
   * @param {Object} userDetails - GitHub user data
   * @returns {Object} Standard OpenID claims
   */
  static mapToClaims(userDetails) {
    return {
      sub: `${userDetails.id}`, // OpenID requires a string
      name: userDetails.name,
      preferred_username: userDetails.login,
      profile: userDetails.html_url,
      picture: userDetails.avatar_url,
      website: userDetails.blog,
      updated_at: NumericDate(
        new Date(Date.parse(userDetails.updated_at))
      )
    };
  }

  /**
   * Finds primary email from user's email addresses
   * @param {Array} userEmails - List of user's email addresses
   * @returns {Object} Primary email information
   * @throws {Error} If no primary email is found
   */
  static findPrimaryEmail(userEmails) {
    const primaryEmail = userEmails.find(email => email.primary);
    if (!primaryEmail) {
      throw new Error('User did not have a primary email address');
    }
    return {
      email: primaryEmail.email,
      email_verified: primaryEmail.verified
    };
  }

  /**
   * Fetches user information from GitHub and maps it to OpenID claims
   * @param {string} accessToken - GitHub access token
   */
  static async getUserInfo(accessToken) {
    try {
      const githubClientInstance = githubClient(
        config.GITHUB_API_URL,
        config.GITHUB_LOGIN_URL
      );

      const userDetails = await githubClientInstance.getUserDetails(accessToken);
      logger.debug({
        message: 'Fetched user details',
        userDetails
      });

      const claims = this.mapToClaims(userDetails);
      logger.debug({
        message: 'Resolved claims',
        claims
      });

      const userEmails = await githubClientInstance.getUserEmails(accessToken);
      logger.debug({
        message: 'Fetched user emails',
        userEmails
      });

      const emailClaims = this.findPrimaryEmail(userEmails);

      return {
        ...claims,
        ...emailClaims
      };
    } catch (error) {
      logger.error({
        message: 'Failed to fetch user info',
        error: error.message || error
      });
      throw error;
    }
  }
}

module.exports = UserInfoService;
