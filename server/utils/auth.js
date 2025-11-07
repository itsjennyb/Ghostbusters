const jwt = require('jsonwebtoken');

const secret = 'mysecretsshhhhh';
const expiration = '2h';

module.exports = {
  authMiddleware: function ({ req }) {
    let token = req.body.token || req.query.token || req.headers.authorization;

    if (req.headers.authorization) {
      token = token.split(' ').pop().trim();
    }

    let user = null;

    if (token) {
      try {
        const { data } = jwt.verify(token, secret, { maxAge: expiration });
        user = data;
      } catch {
        console.log('Invalid token');
      }
    }

    // ✅ ALWAYS return a context object
    return { user };
  },

  signToken: function ({ email, _id, firstName, image }) {
    const payload = { email, _id, firstName, image };
    return jwt.sign({ data: payload }, secret, { expiresIn: expiration });
  },
};