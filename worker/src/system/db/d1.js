// D1 执行封装。所有 repository 经此读写,绑定参数防注入。
// db = makeDb(env);  db.all/first/run(sql, ...params)
export function makeDb(env) {
    const DB = env.DB;
    return {
        async all(sql, ...params) {
            const r = await DB.prepare(sql).bind(...params).all();
            return r.results || [];
        },
        first(sql, ...params) {
            return DB.prepare(sql).bind(...params).first();
        },
        run(sql, ...params) {
            return DB.prepare(sql).bind(...params).run();
        },
    };
}
