// outlines 业务逻辑:树操作(创建/缩进/反缩进/上下移/删子树),移植自原设备端。
import * as repo from './repository.js';

export const tree = (db) => repo.all(db);

// 新建:afterId 给定则插其后,否则追加为末子
export async function create(db, { parentId = null, afterId = 0, text = '' }, now) {
    let sort;
    if (afterId) {
        const after = await repo.get(db, afterId);
        const base = after ? after.sort : 0;
        await repo.shiftAfter(db, parentId, base);
        sort = base + 1;
    } else {
        sort = (await repo.maxSort(db, parentId)) + 1;
    }
    const id = await repo.insert(db, parentId, sort, text, now);
    return { id };
}

export async function update(db, id, { text, collapsed, done }, now) {
    if (text != null) await repo.setText(db, id, text, now);
    if (collapsed != null) await repo.setCollapsed(db, id, collapsed);
    if (done != null) await repo.setDone(db, id, done);
}

export const remove = (db, id) => repo.removeSubtree(db, id);

// 缩进:成为前一个兄弟的末子
export async function indent(db, id) {
    const node = await repo.get(db, id);
    if (!node) return { ok: false };
    const sibs = await repo.siblings(db, node.parent_id);
    const idx = sibs.findIndex((s) => s.id === node.id);
    if (idx <= 0) return { ok: false };
    const prev = sibs[idx - 1];
    const max = await repo.maxSort(db, prev.id);
    await repo.setParentSort(db, id, prev.id, max + 1);
    return { ok: true };
}

// 反缩进:提升到父之后,成为祖父的子
export async function outdent(db, id) {
    const node = await repo.get(db, id);
    if (!node || !node.parent_id) return { ok: false };
    const parent = await repo.get(db, node.parent_id);
    const grand = parent?.parent_id ?? null;
    const base = parent ? parent.sort : 0;
    await repo.shiftAfter(db, grand, base);
    await repo.setParentSort(db, id, grand, base + 1);
    return { ok: true };
}

// 上移/下移:与相邻兄弟交换 sort
export async function move(db, id, dir) {
    const node = await repo.get(db, id);
    if (!node) return { ok: false };
    const sibs = await repo.siblings(db, node.parent_id);
    const idx = sibs.findIndex((s) => s.id === node.id);
    const j = idx + (dir < 0 ? -1 : 1);
    if (j < 0 || j >= sibs.length) return { ok: false };
    const other = sibs[j];
    await repo.setSort(db, id, other.sort);
    await repo.setSort(db, other.id, node.sort);
    return { ok: true };
}
