/**
 * Kept out of mail.module.ts on purpose. The module imports MailService and
 * MailService needs this token, so holding it in the module file makes a cycle
 * that resolves to `undefined` at runtime and fails injection with nothing but
 * "argument at index [0] is unavailable" to go on.
 */
export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
