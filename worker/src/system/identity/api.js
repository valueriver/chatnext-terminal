// identity api 层:/system/identity/<command>
import { json, err, readJson } from '../respond.js';
import * as service from './service.js';

export default async function identityApi(request, ctx, command) {
    const body = request.method === 'POST' ? await readJson(request) : {};

    switch (command) {
        case 'state':           return json(await service.state(ctx));
        case 'setup':           return json(await service.setup(ctx, body));
        case 'login':           return json(await service.login(ctx, body));
        case 'register-device': return json(await service.registerDevice(ctx, body));
        case 'devices':         return json(await service.listDevices(ctx));
        default:                return err(`unknown identity command: ${command}`, 404);
    }
}
