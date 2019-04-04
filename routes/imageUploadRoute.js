const AWS = require('aws-sdk');
const keys = require('../config/keys');
const uuid = require("uuid/v1");
const requireLogin = require('../middlewares/requireLogin');

AWS.config.update({
    region: 'ap-south-1' // region of your bucket
});

const s3 = new AWS.S3({
    accessKeyId: keys.s3AccessKeyId,
    secretAccessKey: keys.s3SecretAccessKey,
})

module.exports = app => {
    app.get('/api/upload',requireLogin, (req, res) => {
        const key = `${req.user.id}/${uuid()}.jpeg`;
        let params = {Bucket: 'blog-test-bucket-123', ContentType: 'image/*', Key: key};
        s3.getSignedUrl('putObject', params, function (err, url) {
            if (err) return console.log(err);
            res.send({key, url});
            //console.log('The URL is', url);
        });
    })
};