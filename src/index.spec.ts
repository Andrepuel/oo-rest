import * as assert from 'assert';
import * as http from 'http';
import * as restify from 'restify';
import { URL } from 'url';
import * as websocket from 'websocket';
import { IMessageHandler, OoServer } from './index';

function tick(): Promise<void> {
    return new Promise((ok) => setTimeout(ok, 10));
}

async function request(urlStr: string, method: 'GET'|'PUT' = 'GET', sendBody?: any)
: Promise<{response: http.IncomingMessage, body: any}> {
    const url = new URL(urlStr);
    const response = await new Promise<http.IncomingMessage>((ok) => {
        const req = http.request({
            headers: {
                'content-type': 'application/json',
            },
            hostname: url.hostname,
            method,
            path: '/' + url.href.split('/', 4)[3],
            port: url.port,
        }, ok);

        if (sendBody) {
            req.write(JSON.stringify(sendBody));
        }
        req.end();
    });
    let body = '';
    response.on('data', (chunk) => body = body + (chunk as string));
    await new Promise((ok, err) => {
        response.on('end', ok);
        response.on('error', err);
    });
    expect(response.headers['content-type']).to.be.equal('application/json');

    return {response, body: JSON.parse(body)};
}

async function connect(url: string): Promise<websocket.connection> {
    const client = new websocket.client();
    const conn = new Promise<websocket.connection>((ok, err) => {
        client.once('connect', ok);
        client.once('connectFailed', err);
    });
    client.connect(url);
    return conn;
}

class TestSubPath extends OoServer {
    public async get_(): Promise<string> {
        return 'sub';
    }
}

interface IPingPong {
    ping: string;
    pong: string;
}

class TestServer extends OoServer {
    public handler: IMessageHandler;

    constructor() {
        super();
    }

    public async get_(): Promise<string> {
        return 'Hello World!';
    }

    public async get_asd(): Promise<string> {
        return 'world';
    }

    public async get_sub() {
        return new TestSubPath();
    }

    public async ws_listen(): Promise<IMessageHandler> {
        return this.handler;
    }

    public async any_echo(obj: IPingPong): Promise<IPingPong> {
        obj.pong += 1;
        return obj;
    }
}

describe('OoServer', () => {
    let rest: TestServer;
    let server: restify.Server;

    beforeEach(() => {
        rest = new TestServer();
        server = restify.createServer({});
        rest.setup(server);
        server.listen(8080);
    });

    it('should return hello world', async () => {
        const result = await request('http://127.0.0.1:8080/');
        expect(result.body).to.be.equal('Hello World!');
    });

    it('should access sub path', async () => {
        const result = await request('http://127.0.0.1:8080/sub');
        expect(result.body).to.be.equal('sub');
    });

    it('should receive and send messages on websocket', async () => {
        const received = new Array<string>();
        let closed = false;
        let sendMsg: (msg: string) => Promise<void>;

        rest.handler = {
            closed: async () => {
                closed = true;
            },
            msg: async (msg: string) => {
                received.push(msg);
            },
            resultType: 'message-handler',
            start: async (a1, a2) => {
                sendMsg = a1;
            },
        };
        const ws = await connect('http://127.0.0.1:8080/listen');
        expect(received.length).to.be.equal(0);
        ws.sendUTF('hello world');
        await tick();
        expect(received.length).to.be.equal(1);
        expect(received[0]).to.be.equal('hello world');

        let recvMsg = '';
        ws.on('message', (data) => recvMsg = data.utf8Data);
        await sendMsg('Hello world!');
        await tick();
        expect(recvMsg).to.be.equal('Hello world!');

        expect(closed).to.be.equal(false);
        ws.close();
        await tick();
        expect(closed).to.be.equal(true);
    });

    it('should be able to closed the socket', async () => {
        let closed = false;
        let clientClosed = false;
        let close: (error?: number, description?: string) => Promise<void>;

        rest.handler = {
            closed: async () => {
                closed = true;
            },
            msg: null,
            resultType: 'message-handler',
            start: async (a1, a2) => {
                close = a2;
            },
        };

        const ws = await connect('http://127.0.0.1:8080/listen');
        ws.on('close', () => clientClosed = true);
        await tick();
        expect(clientClosed).to.be.equal(false);
        await close();
        await tick();
        expect(clientClosed).to.be.equal(true);
        expect(closed).to.be.equal(true);
    });

    it('should be able to close the websocket with error', async () => {
        let closed = false;
        let clientClosed = false;
        let close: (error?: number, description?: string) => Promise<void>;

        rest.handler = {
            closed: async () => {
                closed = true;
            },
            msg: null,
            resultType: 'message-handler',
            start: async (a1, a2) => {
                close = a2;
            },
        };

        const ws = await connect('http://127.0.0.1:8080/listen');
        ws.on('close', (a1, a2) => {
            expect(a1).to.be.equal(500);
            expect(a2).to.be.equal('hello world!');
            clientClosed = true;
        });
        await tick();
        expect(clientClosed).to.be.equal(false);
        await close(500, 'hello world!');
        await tick();
        expect(clientClosed).to.be.equal(true);
    });

    it('should receive request body as first argument', async () => {
        const ping: IPingPong = {ping: 'hello', pong: '2'};
        const result = await request('http://127.0.0.1:8080/echo', 'PUT', ping);
        const pong: IPingPong = result.body as IPingPong;

        expect(pong.ping).to.be.equal('hello');
        expect(pong.pong).to.be.equal('21');
    });

    it('should receive query as first argument', async () => {
        const result = await request('http://127.0.0.1:8080/echo?ping=hello&pong=3');
        const pong: IPingPong = result.body as IPingPong;

        expect(pong.ping).to.be.equal('hello');
        expect(pong.pong).to.be.equal('31');
    });
    afterEach(async () => {
        await new Promise((ok) => server.close(ok));
    });
});
