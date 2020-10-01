import * as http from "http"
import * as net from "net"
import * as querystring from "querystring"
import { Readable } from "stream"

export type Cookies = { [key: string]: string[] | undefined }

export type Query = { [key: string]: string | string[] | undefined }

export interface ProxyOptions {
  /**
   * A path to strip from from the beginning of the request before proxying
   */
  strip?: string
  /**
   * A path to add to the beginning of the request before proxying.
   */
  prepend?: string
  /**
   * The port to proxy.
   */
  port: string
}

export interface HttpResponse<T = string | Buffer | object> {
  /*
   * Whether to set cache-control headers for this response.
   */
  cache?: boolean
  /**
   * If the code cannot be determined automatically set it here. The
   * defaults are 302 for redirects and 200 for successful requests. For errors
   * you should throw an HttpError and include the code there. If you
   * use Error it will default to 404 for ENOENT and EISDIR and 500 otherwise.
   */
  code?: number
  /**
   * Content to write in the response. Mutually exclusive with stream.
   */
  content?: T
  /**
   * Cookie to write with the response.
   * NOTE: Cookie paths must be absolute. The default is /.
   */
  cookie?: { key: string; value: string; path?: string }
  /**
   * Used to automatically determine the appropriate mime type.
   */
  filePath?: string
  /**
   * Additional headers to include.
   */
  headers?: http.OutgoingHttpHeaders
  /**
   * If the mime type cannot be determined automatically set it here.
   */
  mime?: string
  /**
   * Redirect to this path. This is constructed against the site base (not the
   * provider's base).
   */
  redirect?: string
  /**
   * Stream this to the response. Mutually exclusive with content.
   */
  stream?: Readable
  /**
   * Query variables to add in addition to current ones when redirecting. Use
   * `undefined` to remove a query variable.
   */
  query?: Query
  /**
   * Indicates the request should be proxied.
   */
  proxy?: ProxyOptions
}

/**
 * Use when you need to run search and replace on a file's content before
 * sending it.
 */
export interface HttpStringFileResponse extends HttpResponse {
  content: string
  filePath: string
}

export interface WsResponse {
  /**
   * Indicates the web socket should be proxied.
   */
  proxy?: ProxyOptions
}

export interface Route {
  /**
   * Provider base path part (for /provider/base/path it would be /provider).
   */
  providerBase: string
  /**
   * Base path part (for /provider/base/path it would be /base).
   */
  base: string
  /**
   * Remaining part of the route after factoring out the base and provider base
   * (for /provider/base/path it would be /path). It can be blank.
   */
  requestPath: string
  /**
   * Query variables included in the request.
   */
  query: querystring.ParsedUrlQuery
  /**
   * Normalized version of `originalPath`.
   */
  fullPath: string
  /**
   * Original path of the request without any modifications.
   */
  originalPath: string
}

export interface HttpProviderOptions {
  readonly auth: AuthType
  readonly commit: string
  readonly password?: string
}

export enum AuthType {
  Password = "password",
  None = "none",
}

export interface HttpProvider0<T> {
  new (options: HttpProviderOptions): T
}

export interface HttpProvider1<A1, T> {
  new (options: HttpProviderOptions, a1: A1): T
}

export interface HttpProvider2<A1, A2, T> {
  new (options: HttpProviderOptions, a1: A1, a2: A2): T
}

export interface HttpProvider3<A1, A2, A3, T> {
  new (options: HttpProviderOptions, a1: A1, a2: A2, a3: A3): T
}

/**
 * Provides HTTP responses. This abstract class provides some helpers for
 * interpreting, creating, and authenticating responses.
 */
export class HttpProvider {
  protected readonly rootPath: string

  public dispose(): Promise<void>

  /**
   * Handle web sockets on the registered endpoint. Normally the provider
   * handles the request itself but it can return a response when necessary. The
   * default is to throw a 404.
   */
  public handleWebSocket(
    route: Route,
    request: http.IncomingMessage,
    socket: net.Socket,
    head: Buffer,
  ): Promise<WsResponse | void>

  /**
   * Handle requests to the registered endpoint.
   */
  public handleRequest(route: Route, request: http.IncomingMessage): Promise<HttpResponse>

  /**
   * Get the base relative to the provided route. For each slash we need to go
   * up a directory. For example:
   * / => ./
   * /foo => ./
   * /foo/ => ./../
   * /foo/bar => ./../
   * /foo/bar/ => ./../../
   */
  public base(route: Route): string

  /**
   * Get error response.
   */
  public getErrorRoot(route: Route, title: string, header: string, body: string): Promise<HttpResponse>

  /**
   * Replace common templates strings.
   */
  public replaceTemplates(route: Route, response: HttpStringFileResponse, sessionId?: string): HttpStringFileResponse
  public replaceTemplates<T extends object>(
    route: Route,
    response: HttpStringFileResponse,
    options: T,
  ): HttpStringFileResponse
  public replaceTemplates(
    route: Route,
    response: HttpStringFileResponse,
    sessionIdOrOptions?: string | object,
  ): HttpStringFileResponse

  protected get isDev(): boolean

  /**
   * Get a file resource.
   */
  protected getResource(...parts: string[]): Promise<HttpResponse>

  /**
   * Get a file resource as a string.
   */
  protected getUtf8Resource(...parts: string[]): Promise<HttpStringFileResponse>

  /**
   * Helper to error on invalid methods (default GET).
   */
  protected ensureMethod(request: http.IncomingMessage, method?: string | string[]): void

  /**
   * Helper to error if not authorized.
   */
  protected ensureAuthenticated(request: http.IncomingMessage): void

  /**
   * Use the first query value or the default if there isn't one.
   */
  protected queryOrDefault(value: string | string[] | undefined, def: string): string

  /**
   * Return the provided password value if the payload contains the right
   * password otherwise return false. If no payload is specified use cookies.
   */
  public authenticated(request: http.IncomingMessage): string | boolean

  /**
   * Parse POST data.
   */
  protected getData(request: http.IncomingMessage): Promise<string | undefined>

  /**
   * Parse cookies.
   */
  protected parseCookies<T extends Cookies>(request: http.IncomingMessage): T

  /**
   * Return true if the route is for the root page. For example /base, /base/,
   * or /base/index.html but not /base/path or /base/file.js.
   */
  protected isRoot(route: Route): boolean
}

export interface HttpServer {
  /**
   * Register a provider for a top-level endpoint.
   */
  registerHttpProvider<T extends HttpProvider>(endpoint: string | string[], provider: HttpProvider0<T>): T
  registerHttpProvider<A1, T extends HttpProvider>(
    endpoint: string | string[],
    provider: HttpProvider1<A1, T>,
    a1: A1,
  ): T
  registerHttpProvider<A1, A2, T extends HttpProvider>(
    endpoint: string | string[],
    provider: HttpProvider2<A1, A2, T>,
    a1: A1,
    a2: A2,
  ): T
  registerHttpProvider<A1, A2, A3, T extends HttpProvider>(
    endpoint: string | string[],
    provider: HttpProvider3<A1, A2, A3, T>,
    a1: A1,
    a2: A2,
    a3: A3,
  ): T
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerHttpProvider(endpoint: string | string[], provider: any, ...args: any[]): void
}

/**
 * Command line arguments after merging with the defaults.
 */
export interface Args {
  "user-data-dir"?: string
  _: string[]
}

export type Activate = (server: HttpServer, args: Args) => void

/**
 * Plugins must implement this interface.
 */
export interface Plugin {
  activate: Activate
}
