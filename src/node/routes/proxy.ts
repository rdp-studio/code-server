import { Request, Router } from "express"
import proxyServer from "http-proxy"
import qs from "qs"
import { HttpCode, HttpError } from "../../common/http"
import { authenticated, redirect } from "../http"

export const router = Router()

const proxy = proxyServer.createProxyServer({})
proxy.on("error", (error, _request, response) => {
  response.writeHead(HttpCode.ServerError)
  response.end(error.message)
})

const getProxyTarget = (req: Request): string => {
  // TODO: Need some mechanism to toggle this based on the application.
  const rewrite = true
  const target = rewrite ? `${req.params[0]}?${qs.stringify(req.query)}` : req.originalUrl
  return `http://127.0.0.1:${req.params.port}${target}`
}

router.get("/:port*", (req, res) => {
  if (!authenticated(req)) {
    // If visiting the root (/proxy/:port and nothing else) redirect to the
    // login page.
    if (!req.params[0]) {
      return redirect(req, res, "login", {
        to: `${req.baseUrl}/${req.path}/` || "/",
      })
    }
    throw new HttpError("Unauthorized", HttpCode.Unauthorized)
  }

  proxy.web(req, res, {
    ignorePath: true,
    target: getProxyTarget(req),
  })
})

router.ws("/:port*", (req, socket, head) => {
  console.log("going to proxy!", req.path, req.params)
  // proxy.ws(req, socket, head, {
  //   ignorePath: true,
  //   target: getProxyTarget(req),
  // })
})

// /**
//  * Proxy HTTP provider.
//  */
// export class ProxyHttpProvider extends HttpProvider {
//   public async handleRequest(route: Route, request: http.IncomingMessage): Promise<HttpResponse> {

//     const port = route.base.replace(/^\//, "")
//     return {
//       proxy: {
//         strip: `${route.providerBase}/${port}`,
//         port,
//       },
//     }
//   }

//   public async handleWebSocket(route: Route, request: http.IncomingMessage): Promise<WsResponse> {
//     this.ensureAuthenticated(request)
//     const port = route.base.replace(/^\//, "")
//     return {
//       proxy: {
//         strip: `${route.providerBase}/${port}`,
//         port,
//       },
//     }
//   }
// }
