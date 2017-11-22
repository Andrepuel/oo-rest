import * as restify from 'restify';
import * as process from 'process';

function nothrow(x: Promise<any>) {
	x.catch((e) => {
		console.error('failed nonthrow promise');
		console.error(e);
		process.abort();
	});
}

class OoServer {
	public setup(s: restify.Server): void {
		s.get(".*", this.handle.bind(this));
		s.put(".*", this.handle.bind(this));
		s.post(".*", this.handle.bind(this));
		s.del(".*", this.handle.bind(this));
	}

	public handle(req: restify.Request, res: restify.Response, next: restify.Next) {
		let url = req.url.split('/').filter(x => x.length > 0);
		nothrow(this.findRoute(url, req, res, next));
	}

	public async findRoute(url: string[], req: restify.Request, res: restify.Response, next: restify.Next) {
		if (url.length == 0) {
			url = [''];
		}
		console.log("find ", url);
		try {
			let route = this[req.method.toLowerCase() + "_" + url[0]] || this["any_" + url[0]];
			console.log(route);
			if (route) {
				let x = await Promise.resolve().then(() => route(req, res));
				if (x instanceof OoServer) {
					return x.findRoute(url.slice(1), req, res, next);
				}
				res.send(x);
			} else {
				res.send(404);
			}
			next();
		} catch(e) {
			next(e);
		}
	}
}

class TestSubPath extends OoServer {
	public async get_(): Promise<string> {
		return "sub";
	}
}

class TestServer extends OoServer {
	x: number;

	constructor() {
		super();
		this.x = 2;
	}

	public async get_(): Promise<string> {
		return "Hello";
	}

	public async get_asd(): Promise<string> {
		return "world";
	}

	public async get_sub() {
		return new TestSubPath();
	}
}

let x = restify.createServer({});
(new TestServer()).setup(x);
x.listen(8080);