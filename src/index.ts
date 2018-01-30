import * as process from 'process';
import * as restify from 'restify';

function nothrow(x: Promise<any>) {
    x.catch((e) => {
        console.error('failed nonthrow promise');
        console.error(e);
        process.abort();
    });
}

export class OoServer {
    public setup(s: restify.Server): void {
        s.get('.*', this.handle.bind(this));
        s.put('.*', this.handle.bind(this));
        s.post('.*', this.handle.bind(this));
        s.del('.*', this.handle.bind(this));
    }

    public handle(req: restify.Request, res: restify.Response, next: restify.Next) {
        const url = req.url.split('/').filter((x) => x.length > 0);
        nothrow(this.findRoute(url, req, res, next));
    }

    public async findRoute(url: string[], req: restify.Request, res: restify.Response, next: restify.Next) {
        if (url.length === 0) {
            url = [''];
        }
        try {
            const route = this[req.method.toLowerCase() + '_' + url[0]] || this['any_' + url[0]];
            if (route) {
                const x = await Promise.resolve().then(() => route(req, res));
                if (x instanceof OoServer) {
                    return x.findRoute(url.slice(1), req, res, next);
                }
                res.send(x);
            } else {
                res.send(404);
            }
            next();
        } catch (e) {
            next(e);
        }
    }
}
