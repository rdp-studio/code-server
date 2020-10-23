import { logger } from "@coder/logger"
import bodyParser from "body-parser"
import cookieParser from "cookie-parser"
import { Express } from "express"
import { promises as fs } from "fs"
import http from "http"
import * as path from "path"
import * as tls from "tls"
import { HttpCode, HttpError } from "../../common/http"
import { plural } from "../../common/util"
import { AuthType, DefaultedArgs } from "../cli"
import { rootPath } from "../constants"
import { Heart } from "../heart"
import { replaceTemplates } from "../http"
import { loadPlugins } from "../plugin"
import { getMediaMime, paths } from "../util"
import * as health from "./health"
import * as login from "./login"
import * as proxy from "./proxy"
// static is a reserved keyword.
import * as _static from "./static"
import * as update from "./update"
import * as vscode from "./vscode"

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    export interface Request {
      args: DefaultedArgs
      heart: Heart
    }
  }
}

/**
 * Register all routes and middleware.
 */
export const register = async (app: Express, server: http.Server, args: DefaultedArgs): Promise<void> => {
  const heart = new Heart(path.join(paths.data, "heartbeat"), async () => {
    return new Promise((resolve, reject) => {
      server.getConnections((error, count) => {
        if (error) {
          return reject(error)
        }
        logger.trace(plural(count, `${count} active connection`))
        resolve(count > 0)
      })
    })
  })

  app.disable("x-powered-by")

  app.use(cookieParser())
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))

  server.on("upgrade", () => {
    heart.beat()
  })

  app.use(async (req, res, next) => {
    heart.beat()

    // If we're handling TLS ensure all requests are redirected to HTTPS.
    // TODO: This does *NOT* work if you have a base path since to specify the
    // protocol we need to specify the whole path.
    if (args.cert && !(req.connection as tls.TLSSocket).encrypted) {
      return res.redirect(`https://${req.headers.host}${req.originalUrl}`)
    }

    // Return robots.txt.
    if (req.originalUrl === "/robots.txt") {
      const resourcePath = path.resolve(rootPath, "src/browser/robots.txt")
      res.set("Content-Type", getMediaMime(resourcePath))
      return res.send(await fs.readFile(resourcePath))
    }

    // TODO: Proxy

    // Add common variables routes can use.
    req.args = args
    req.heart = heart

    return next()
  })

  app.use("/", vscode.router)
  app.use("/healthz", health.router)
  if (args.auth === AuthType.Password) {
    app.use("/login", login.router)
  }
  app.use("/proxy", proxy.router)
  app.use("/static", _static.router)
  app.use("/update", update.router)
  app.use("/vscode", vscode.router)

  await loadPlugins(app, args)

  app.use(() => {
    throw new HttpError("Not Found", HttpCode.NotFound)
  })

  // Handle errors.
  // TODO: The types are broken; says they're all implicitly `any`.
  app.use(async (err: any, req: any, res: any, next: any) => {
    const resourcePath = path.resolve(rootPath, "src/browser/pages/error.html")
    res.set("Content-Type", getMediaMime(resourcePath))
    try {
      const content = await fs.readFile(resourcePath, "utf8")
      res.status(err.status || 500).send(
        replaceTemplates(req, content)
          .replace(/{{ERROR_TITLE}}/g, err.status)
          .replace(/{{ERROR_HEADER}}/g, err.status)
          .replace(/{{ERROR_BODY}}/g, err.message),
      )
    } catch (error) {
      next(error)
    }
  })
}
