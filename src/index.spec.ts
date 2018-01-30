import * as http from 'http';
import * as restify from 'restify';
import { OoServer } from './index';

async function request(url: string): Promise<{response: http.IncomingMessage, body: any}> {
    const response = await new Promise<http.IncomingMessage>((ok) => {
        return http.get(url, ok);
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

class TestSubPath extends OoServer {
    public async get_(): Promise<string> {
        return 'sub';
    }
}

class TestServer extends OoServer {
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

    afterEach(async () => {
        await new Promise((ok) => server.close(ok));
    });
});
