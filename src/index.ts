import * as assert from 'assert';
import * as process from 'process';
import * as restify from 'restify';
import * as websocket from 'websocket';

function nothrow(x: Promise<any>) {
    x.catch((e) => {
        console.error('failed nonthrow promise');
        console.error(e);
        process.abort();
    });
}
function nothrowf(x: () => Promise<any>) {
    nothrow(x());
}

export interface IMessageHandler {
    resultType: 'message-handler';
    start(sendMsg: (msg: string) => Promise<void>, close: (error: number, reason: string) => Promise<void>);
    msg(msg: string): Promise<void>;
    closed(reason: number, message: string): Promise<void>;
}

interface IWebsocketExtra {
    handler: IMessageHandler;
}

export class OoServer {
    public setup(s: restify.Server): void {
        s.get('.*', this.handle.bind(this));
        s.put('.*', this.handle.bind(this));
        s.post('.*', this.handle.bind(this));
        s.del('.*', this.handle.bind(this));
        const ws = new websocket.server({httpServer: s});
        ws.on('request', this.handleWs.bind(this));
    }

    public handle(req: restify.Request, res: restify.Response, next: restify.Next) {
        const url = req.url.split('/').filter((x) => x.length > 0);
        nothrowf(async () => {
            try {
                const r = await this.findRoute(url, req.method);
                if (r === null) {
                    return res.send(404);
                }

                res.send(r);
            } catch (e) {
                res.send(e);
            } finally {
                next();
            }
        });
    }

    public async handleWs(req: websocket.request) {
        const url = req.httpRequest.url.split('/').filter((x) => x.length > 0);
        nothrowf(async () => {
            let conn: websocket.connection&IWebsocketExtra = null;
            try {
                const r = await this.findRoute(url, 'ws') as IMessageHandler;
                if (r === null) {
                    return req.reject(404);
                }

                assert.equal(r.resultType, 'message-handler');
                conn = req.accept() as (websocket.connection&IWebsocketExtra);
                conn.handler = r;
                conn.handler.start(async (msg) => {
                    conn.sendUTF(msg);
                },
                async (error, reason) => {
                    if (error) {
                        conn.drop(error, reason);
                    } else {
                        conn.close();
                    }
                });
                conn.on('message', (data) => nothrowf(async () => {
                    await conn.handler.msg(data.utf8Data);
                }));
                conn.on('close', (a1, a2) => nothrowf(async () => {
                    await conn.handler.closed(a1, a2);
                }));
            } catch (e) {
                console.error(e);
                if (conn !== null) {
                    conn.drop(500, JSON.stringify(e));
                } else {
                    req.reject(500, JSON.stringify(e));
                }
            }
        });
    }

    public async findRoute(url: string[], method: string) {
        if (url.length === 0) {
            url = [''];
        }

        const route = this[method.toLowerCase() + '_' + url[0]] || this['any_' + url[0]];
        if (route) {
            const x = await Promise.resolve().then(() => route.apply(this));
            if (x instanceof OoServer) {
                return x.findRoute(url.slice(1), method);
            }
            return x;
        } else {
            return null;
        }
    }
}
