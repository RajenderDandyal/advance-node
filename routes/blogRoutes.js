const mongoose = require('mongoose');
const requireLogin = require('../middlewares/requireLogin');
const redis = require('redis');
const Blog = mongoose.model('Blog');
const util = require('util');
const {cleanCache} = require("../services/cache");

module.exports = app => {
  app.get('/api/blogs/:id', requireLogin, async (req, res) => {
    const blog = await Blog.findOne({
      _user: req.user.id,
      _id: req.params.id
    });

    res.send(blog);
  });

  app.get('/api/blogs', requireLogin, async (req, res) => {
    const blogs = await Blog.find({_user: req.user.id}).cache();
    res.send(blogs);
  });

  app.post('/api/blogs', requireLogin, async (req, res) => {
    const {title, content} = req.body;

    const blog = new Blog({
      title,
      content,
      _user: req.user.id
    });

    try {
      await blog.save();
      await cleanCache({"_user":req.user._id,"collection":"blogs"});
      res.send(blog);
    } catch (err) {
      res.send(400, err);
    }
  });
};
