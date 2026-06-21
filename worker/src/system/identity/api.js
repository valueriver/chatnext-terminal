// identity api 层:/system/identity/<command>
import * as service from './service.js';

export default async function identityApi(request, ctx, command) {
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};

    switch (command) {
        case 'state':           return Response.json(await service.state(ctx));
        case 'setup':           return Response.json(await service.setup(ctx, body));
        case 'login':           return Response.json(await service.login(ctx, body));
        case 'register-device': return Response.json(await service.registerDevice(ctx, body));
        case 'devices':         return Response.json(await service.listDevices(ctx));
        default:                return Response.json({ error: `unknown identity command: ${command}` }, { status: 404 });
    }
}
