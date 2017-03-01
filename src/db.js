import moment from 'moment'
import _ from 'lodash'

import { DatabaseHelpers as helpers } from 'botpress'

const Validate = require('validate-arguments')

module.exports = bp => {
  return {
    bootstrap: () => {
      return bp.db.get()
      .then(initialize)
    },
    listAll: () => {
      return bp.db.get()
      .then(listAllSubscription)
    },
    create: (category) => {
      return bp.db.get()
      .then(knex => create(knex, category))
    },
    modify: (id, options) => {
      return bp.db.get()
      .then(knex => update(knex, id, options))
    },
    delete: (id) => {
      return bp.db.get()
      .then(knex => remove(knex, id))
    },
    subscribe: (userId, category) => {
      return bp.db.get()
      .then(knex => subscribe(knex, userId, category))
    },
    unsubscribe: (userId, category) => {
      return bp.db.get()
      .then(knex => unsubscribe(knex, userId, category))
    },
    isSubscribed: (userId, category) => {
      return bp.db.get()
      .then(knex => isSubscribed(knex, userId, category))
    },
    getSubscribed: (userId) => {
      return bp.db.get()
      .then(knex => getSubscribed(knex, userId))
    }
  }
}

function initialize(knex) {
  return helpers(knex).createTableIfNotExists('subscriptions', function (table) {
    table.increments('id').primary()
    table.timestamp('created_on')
    table.string('category')
    table.string('sub_keywords')
    table.string('unsub_keywords')
    table.string('sub_action')
    table.string('unsub_action')
    table.string('sub_action_type')
    table.string('unsub_action_type')
  })
  .then(function() {
    return helpers(knex).createTableIfNotExists('subscription_users', function (table) {
      table.integer('subscriptionId').references('subscriptions.id')
      table.string('userId').references('users.id')
      table.primary(['subscriptionId', 'userId'])
      table.timestamp('ts')
    })
  })
  .then(function() {
    // Query compatible with SQLite3 & Postgres 9.5
    return knex.schema.raw(`create unique index
      if not exists "subscriptions_category_unique" 
      on "subscriptions" ("category")`)
    .then()
  })
}

function mapSubscriptions(subs) {
  return subs.map(sub => {
    sub.sub_keywords = JSON.parse(sub.sub_keywords)
    sub.unsub_keywords = JSON.parse(sub.unsub_keywords)
    return sub
  })
}

function listAllSubscription(knex) {
  return knex('subscriptions')
  .leftJoin('subscription_users', 'subscription_users.subscriptionId', 'subscriptions.id')
  .groupBy('subscriptions.id')
  .select(knex.raw(`subscriptions.*, count("userId") as count`))
  .then(mapSubscriptions)
}

function create(knex, category) {
  if (typeof category !== 'string' || category.length < 1) {
    throw new Error('Category must be a valid string')
  }

  const upper = category.toUpperCase()

  return knex('subscriptions')
  .insert({
    created_on: helpers(knex).date.now(),
    category: category,
    sub_keywords: JSON.stringify(['SUBSCRIBE_' + upper]),
    unsub_keywords: JSON.stringify(['UNSUBSCRIBE_' + upper]),
    sub_action: 'Successfully subscribed to ' + category,
    sub_action_type: 'text',
    unsub_action: 'You are now unsubscribed from ' + category,
    unsub_action_type: 'text'
  })
}

function update(knex, id, options) {
  options = validateOptions(options)

  return knex('subscriptions')
  .where('id', id)
  .update({
    category: options.category,
    sub_keywords: JSON.stringify(options.sub_keywords),
    unsub_keywords: JSON.stringify(options.unsub_keywords),
    sub_action: options.sub_action,
    sub_action_type: options.sub_action_type,
    unsub_action: options.unsub_action,
    unsub_action_type: options.unsub_action_type
  })
}

function remove(knex, id) {
  return knex('subscription_users')
  .where('subscriptionId', id)
  .del()
  .then(() => {
    return knex('subscriptions')
    .where('id', id)
    .del()
  })
}

function subscribe(knex, userId, category) {
  return knex('subscriptions')
  .where('category', category)
  .then().get(0).then(sub => {
    if (!sub) {
      throw new Error('Could not find subscription of category: ' + category)
    }
    
    return knex('subscription_users')
    .insert({
      subscriptionId: sub.id,
      userId: userId,
      ts: helpers(knex).date.now()
    })
  })
}

function unsubscribe(knex, userId, category) {
  return knex('subscriptions')
  .where('category', category)
  .then().get(0).then(sub => {
    if (!sub) {
      throw new Error('Could not find subscription of category: ' + category)
    }

    return knex('subscription_users')
    .where({
      subscriptionId: sub.id,
      userId: userId
    })
    .del()
  })
}

function isSubscribed(knex, userId, category) {
  return getSubscribed(knex, userId)
  .then(subs => _.includes(subs, category))
}

function getSubscribed(knex, userId) {
  return knex('subscription_users')
  .join('subscriptions', 'subscriptions.id', 'subscription_users.subscriptionId')
  .where({ userId })
  .select('category')
  .then(subs => subs.map(s => s.category))
}

function validateOptions(options) {
  const args = Validate.named(options, {
    category: 'string',
    sub_keywords: 'array',
    unsub_keywords: 'array',
    sub_action: 'string',
    unsub_action: 'string',
    sub_action_type: 'string',
    unsub_action_type: 'string'
  })

  if(!args.isValid()) {
    throw args.errorString()
  }

  return _.pick(options, [
    'category', 
    'sub_keywords', 
    'unsub_keywords',
    'sub_action',
    'unsub_action',
    'sub_action_type',
    'unsub_action_type'
  ])
}
