import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  login: text('login').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at').notNull(),
}, t=>[uniqueIndex('users_login_unique').on(t.login)]);
export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
  expiresAt: integer('expires_at').notNull(),
}, t=>[index('sessions_user_idx').on(t.userId),index('sessions_expiry_idx').on(t.expiresAt)]);
export const compositions = sqliteTable('compositions', {
  id: text('id').primaryKey(),
  authorId: text('author_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
  title: text('title').notNull(),
  data: text('data').notNull(),
  revision: integer('revision').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, t=>[index('compositions_author_updated_idx').on(t.authorId,t.updatedAt)]);
export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, t=>[index('rate_limits_expiry_idx').on(t.expiresAt)]);
