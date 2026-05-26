export default {
    from: 'v0.0.0',
    to: 'v0.0.1',
    requiresUserInput: false,
    async gather(old, ctx) {
        ctx.log('Starting v0.0.0 -> v0.0.1');
        const field = ctx.key(`${old.some.field[5]}`);
        ctx.warn('Data is discarded?');
        return { new: 'fields', old: field };
    },
    async migrate(old, ctx) {
        ctx.warn('this isn\'t implemented yet');
        return {
            new: "fields"
        }
    }
}