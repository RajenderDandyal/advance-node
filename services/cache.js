const mongoose = require("mongoose");
const redis = require("redis");
const util = require('util');


/* REDIS KEYS
{"_user":"5c9e631284e41d3098ede2ae","collection":"blogs"}
{"_id":"5c9e631284e41d3098ede2ae","collection":"users"}
*/
// default redis url
const redisUrl = "redis://127.0.0.1:6379";
// create redis client
const client = redis.createClient(redisUrl);
// promisify the get and set function as they don't return the promises and return callback only
client.get = util.promisify(client.get);
client.set = util.promisify(client.set);

// copy the exec function from Query constructor and prototype
const exec = mongoose.Query.prototype.exec;

// only Query with .cache() will cache the response .. otherwise will get response from mongodb and return that
// this is one step to save the ram memory for redis {it can be costly}
mongoose.Query.prototype.cache = function(){
  // set the useCache property to Query object
  this.useCache = true;

  // return this will allow chaining ex Blog.find({_user:adadadaferer}).cache().limit(1).sort(-_user)
  return this
};


// now change the original exec function as per our need then
// return either the copied exec(which trigger call to mongoDb) or the cache value
mongoose.Query.prototype.exec = async function () {
  // this --- refer to current Query

  // if useCache property is not set to query object then directly go to mongodb for data
  if (!this.useCache) {
    console.log("From mongodb");
    return exec.apply(this, arguments)
  }

  // key for redis should be unique and consistent
  // so we are merging current query object and the collection name to get unique key
  const key = JSON.stringify(Object.assign({}, this.getQuery(), {collection: this.mongooseCollection.name}));
  //console.log(key);

  // first check whether we have a key in redis
  // if yes then return that as mongoose model
  const cacheValue = await client.get(key);
  if (cacheValue) {
    //console.log("cache value", cacheValue);
    console.log("From cache");

    // return statement from exec function should be mongoose model instance/ documents not the plain objects

    // if we have single object eg. for current user then ... return new this.model(doc) ..
    // after converting it into mongoose document

    // if we have array of object eg. for blog posts then ... return doc.map(singleDoc => new this.model(singleDoc)) ..
    // after converting each object inside array into mongoose documents
    const doc = JSON.parse(cacheValue);
    return Array.isArray(doc) ? doc.map(singleDoc => new this.model(singleDoc)) : new this.model(doc);
  }


  // otherwise execute the original copied exec to reach out mongodb and return the result
  const result = await exec.apply(this, arguments);
  // set the result to redis then return
  console.log("From mongodb 2");

  await client.set(key, JSON.stringify(result), 'EX',1000);// cache expires after 100 seconds
  return result
};

module.exports = {
  async cleanCache(key={default:"key"}){
    await client.del(JSON.stringify(key))
  }
};

/////////////////////////////////////////////
//// With hash keys  ///////////////////////
////////////////////////////////////////////
/*
*
const client = redis.createClient(keys.redisUrl);
client.hget = util.promisify(client.hget);
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function(options = {}) {
  this.useCache = true;
  this.hashKey = JSON.stringify(options.key || '');

  return this;
};

mongoose.Query.prototype.exec = async function() {
  if (!this.useCache) {
    return exec.apply(this, arguments);
  }

  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name
    })
  );

  // See if we have a value for 'key' in redis
  const cacheValue = await client.hget(this.hashKey, key);

  // If we do, return that
  if (cacheValue) {
    const doc = JSON.parse(cacheValue);

    return Array.isArray(doc)
      ? doc.map(d => new this.model(d))
      : new this.model(doc);
  }

  // Otherwise, issue the query and store the result in redis
  const result = await exec.apply(this, arguments);

  client.hset(this.hashKey, key, JSON.stringify(result), 'EX', 10);

  return result;
};

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  }
};
* */