/*!
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {util} from '@google-cloud/common';
import {paginator} from '@google-cloud/paginator';
import {replaceProjectIdToken} from '@google-cloud/projectify';
import {callbackifyAll} from '@google-cloud/promisify';
import arrify = require('arrify');
import * as extend from 'extend';
import * as gax from 'google-gax';
// eslint-disable-next-line node/no-extraneous-import
import {ClientReadableStream} from '@grpc/grpc-js';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pumpify = require('pumpify');
import * as streamEvents from 'stream-events';
import * as through from 'through2';
import * as middleware from './middleware';
import {detectServiceContext} from './metadata';
import {StackdriverHttpRequest as HttpRequest} from './http-request';

export {middleware};
export {HttpRequest};
export {detectServiceContext};

const version = require('../../package.json').version;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const v2 = require('./v2');

import {Entry, LogEntry} from './entry';
import {
  Log,
  GetEntriesRequest,
  LogOptions,
  MonitoredResource,
  Severity,
  SeverityNames,
} from './log';
import {Sink} from './sink';
import {Duplex} from 'stream';
import {google} from '../protos/protos';

import {Bucket} from '@google-cloud/storage'; // types only
import {Dataset, BigQuery} from '@google-cloud/bigquery'; // types only
import {Topic} from '@google-cloud/pubsub'; // types only

export interface LoggingOptions extends gax.GrpcClientOptions {
  autoRetry?: boolean;
  maxRetries?: number;
  apiEndpoint?: string;
}

export interface DeleteCallback {
  (error?: Error | null, response?: google.protobuf.Empty): void;
}

export type DeleteResponse = google.protobuf.Empty;

export type LogSink = google.logging.v2.ILogSink;

export interface AbortableDuplex extends Duplex {
  abort(): void;
}

export interface CreateSinkRequest {
  // destination: Bucket|Dataset|Topic|string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  destination: any;
  filter?: string;
  includeChildren?: boolean;
  name?: string;
  outputVersionFormat?: google.logging.v2.LogSink.VersionFormat;
  uniqueWriterIdentity?: string;
  gaxOptions?: gax.CallOptions;
}

export interface CreateSinkCallback {
  (err: Error | null, sink?: Sink | null, resp?: LogSink): void;
}

export type GetEntriesResponse = [
  Entry[],
  google.logging.v2.IListLogEntriesRequest,
  google.logging.v2.IListLogEntriesResponse
];

export interface GetEntriesCallback {
  (
    err: Error | null,
    entries?: Entry[],
    request?: google.logging.v2.IListLogEntriesRequest,
    apiResponse?: google.logging.v2.IListLogEntriesResponse
  ): void;
}

export interface GetLogsRequest {
  autoPaginate?: boolean;
  gaxOptions?: gax.CallOptions;
  maxApiCalls?: number;
  maxResults?: number;
  pageSize?: number;
  pageToken?: string;
}

export type GetLogsResponse = [
  Sink[],
  google.logging.v2.IListLogsRequest,
  google.logging.v2.IListLogsResponse
];

export interface GetLogsCallback {
  (
    err: Error | null,
    entries?: Sink[],
    request?: google.logging.v2.IListLogsRequest,
    apiResponse?: google.logging.v2.IListLogsResponse
  ): void;
}

export interface GetSinksRequest {
  autoPaginate?: boolean;
  gaxOptions?: gax.CallOptions;
  maxApiCalls?: number;
  maxResults?: number;
  pageSize?: number;
  pageToken?: string;
}

export type GetSinksResponse = [
  Sink[],
  google.logging.v2.IListSinksRequest,
  google.logging.v2.IListSinksResponse
];

export interface GetSinksCallback {
  (
    err: Error | null,
    entries?: Sink[],
    request?: google.logging.v2.IListSinksRequest,
    apiResponse?: google.logging.v2.IListSinksResponse
  ): void;
}
export type Client = string;

export interface RequestConfig {
  client: Client;
  method: string;
  reqOpts?: object;
  gaxOpts?: gax.CallOptions;
}

export interface RequestCallback<TResponse> {
  (err: Error | null, res?: TResponse): void;
}

interface GaxRequestCallback {
  (err: Error | null, requestFn?: Function): void;
}
/**
 * For logged errors, one can provide a the service context. For more
 * information see [this guide]{@link
 * https://cloud.google.com/error-reporting/docs/formatting-error-messages}
 * and the [official documentation]{@link
 * https://cloud.google.com/error-reporting/reference/rest/v1beta1/ServiceContext}.
 */
export interface ServiceContext {
  /**
   * An identifier of the service, such as the name of the executable, job, or
   * Google App Engine service name.
   */
  service?: string;
  /**
   * Represents the version of the service.
   */
  version?: string;
}

/**
 * @typedef {object} ClientConfig
 * @property {string} [projectId] The project ID from the Google Developer's
 *     Console, e.g. 'grape-spaceship-123'. We will also check the environment
 *     variable `GCLOUD_PROJECT` for your project ID. If your app is running in
 *     an environment which supports {@link
 * https://cloud.google.com/docs/authentication/production#providing_credentials_to_your_application
 * Application Default Credentials}, your project ID will be detected
 * automatically.
 * @property {string} [keyFilename] Full path to the a .json, .pem, or .p12 key
 *     downloaded from the Google Developers Console. If you provide a path to a
 *     JSON file, the `projectId` option above is not necessary. NOTE: .pem and
 *     .p12 require you to specify the `email` option as well.
 * @property {string} [email] Account email address. Required when using a .pem
 *     or .p12 keyFilename.
 * @property {object} [credentials] Credentials object.
 * @property {string} [credentials.client_email]
 * @property {string} [credentials.private_key]
 * @property {boolean} [autoRetry=true] Automatically retry requests if the
 *     response is related to rate limits or certain intermittent server errors.
 *     We will exponentially backoff subsequent requests by default.
 * @property {number} [maxRetries=3] Maximum number of automatic retries
 *     attempted before returning the error.
 * @property {Constructor} [promise] Custom promise module to use instead of
 *     native Promises.
 */
/**
 * [Stackdriver Logging](https://cloud.google.com/logging/docs) allows you to
 * store, search, analyze, monitor, and alert on log data and events from Google
 * Cloud Platform and Amazon Web Services (AWS).
 *
 * @class
 *
 * @see [What is Stackdriver Logging?](https://cloud.google.com/logging/docs)
 * @see [Introduction to the Stackdriver Logging API](https://cloud.google.com/logging/docs/api)
 * @see [Logging to Stackdriver from Bunyan](https://www.npmjs.com/package/@google-cloud/logging-bunyan)
 * @see [Logging to Stackdriver from Winston](https://www.npmjs.com/package/@google-cloud/logging-winston)
 *
 * @param {ClientConfig} [options] Configuration options.
 *
 * @example <caption>Import the client library</caption>
 * const {Logging} = require('@google-cloud/logging');
 *
 * @example <caption>Create a client that uses <a href="https://cloud.google.com/docs/authentication/production#providing_credentials_to_your_application">Application Default Credentials (ADC)</a>:</caption>
 * const logging = new Logging();
 *
 * @example <caption>Create a client with <a href="https://cloud.google.com/docs/authentication/production#obtaining_and_providing_service_account_credentials_manually">explicitcredentials</a>:</caption>
 * const logging = new Logging({ projectId:
 *  'your-project-id', keyFilename: '/path/to/keyfile.json'
 * });
 *
 * @example <caption>include:samples/quickstart.js</caption>
 * region_tag:logging_quickstart
 * Full quickstart example:
 */
class Logging {
  api: {[key: string]: gax.ClientStub};
  auth: gax.GoogleAuth;
  options: LoggingOptions;
  projectId: string;
  detectedResource?: object;
  configService?: typeof v2.ConfigServiceV2Client;
  loggingService?: typeof v2.LoggingServiceV2Client;

  constructor(options?: LoggingOptions) {
    // Determine what scopes are needed.
    // It is the union of the scopes on all three clients.
    const scopes: Array<{}> = [];
    const clientClasses = [
      v2.ConfigServiceV2Client,
      v2.LoggingServiceV2Client,
      v2.MetricsServiceV2Client,
    ];
    for (const clientClass of clientClasses) {
      for (const scope of clientClass.scopes) {
        if (scopes.indexOf(scope) === -1) {
          scopes.push(scope);
        }
      }
    }
    const options_ = extend(
      {
        libName: 'gccl',
        libVersion: version,
        scopes,
      },
      options
    );
    this.api = {};
    this.auth = new gax.GoogleAuth(options_);
    this.options = options_;
    this.projectId = this.options.projectId || '{{projectId}}';
    this.configService = new v2.ConfigServiceV2Client(this.options);
    this.loggingService = new v2.LoggingServiceV2Client(this.options);
  }

  createSink(name: string, config: CreateSinkRequest): Promise<[Sink, LogSink]>;
  createSink(
    name: string,
    config: CreateSinkRequest,
    callback: CreateSinkCallback
  ): void;
  /**
   * Config to set for the sink. Not all available options are listed here, see
   * the [Sink
   * resource](https://cloud.google.com/logging/docs/reference/v2/rest/v2/projects.sinks#LogSink)
   * definition for full details.
   *
   * @typedef {object} CreateSinkRequest
   * @property {object} [gaxOptions] Request configuration options, outlined
   *     here: https://googleapis.github.io/gax-nodejs/global.html#CallOptions.
   * @property {Bucket|Dataset|Topic} [destination] The destination. The proper ACL
   *     scopes will be granted to the provided destination. Can be one of:
   *     {@link
   * https://cloud.google.com/nodejs/docs/reference/storage/latest/Bucket
   * Bucket},
   *     {@link
   * https://cloud.google.com/nodejs/docs/reference/bigquery/latest/Dataset
   * Dataset}, or {@link
   * https://cloud.google.com/nodejs/docs/reference/pubsub/latest/Topic Topic}
   * @property {string} [filter] An advanced logs filter. Only log entries
   *     matching the filter are written.
   * @property {string} [uniqueWriterIdentity] Determines the kind of IAM
   *     identity returned as `writerIdentity` in the new sink. See {@link https://cloud.google.com/logging/docs/reference/v2/rest/v2/projects.sinks/create#query-parameters}.
   */
  /**
   * @typedef {array} CreateSinkResponse
   * @property {Sink} 0 The new {@link Sink}.
   * @property {object} 1 The full API response.
   */
  /**
   * @callback CreateSinkCallback
   * @param {?Error} err Request error, if any.
   * @param {Sink} sink The new {@link Sink}.
   * @param {object} apiResponse The full API response.
   */
  // jscs:disable maximumLineLength
  /**
   * Create a sink.
   *
   * @see [Sink Overview]{@link https://cloud.google.com/logging/docs/reference/v2/rest/v2/projects.sinks}
   * @see [Advanced Logs Filters]{@link https://cloud.google.com/logging/docs/view/advanced_filters}
   * @see [projects.sinks.create API Documentation]{@link https://cloud.google.com/logging/docs/reference/v2/rest/v2/projects.sinks/create}
   *
   * @param {string} name Name of the sink.
   * @param {CreateSinkRequest} config Config to set for the sink.
   * @param {CreateSinkCallback} [callback] Callback function.
   * @returns {Promise<CreateSinkResponse>}
   * @throws {Error} If a name is not provided.
   * @throws {Error} if a config object is not provided.
   * @see Sink#create
   *
   * @example
   * const {Storage} = require('@google-cloud/storage');
   * const storage = new Storage({
   *   projectId: 'grape-spaceship-123'
   * });
   * const {Logging} = require('@google-cloud/logging');
   * const logging = new Logging();
   *
   * const config = {
   *   destination: storage.bucket('logging-bucket'),
   *   filter: 'severity = ALERT'
   * };
   *
   * function callback(err, sink, apiResponse) {
   *   // `sink` is a Sink object.
   * }
   *
   * logging.createSink('new-sink-name', config, callback);
   *
   * //-
   * // If the callback is omitted, we'll return a Promise.
   * //-
   * logging.createSink('new-sink-name', config).then(data => {
   *   const sink = data[0];
   *   const apiResponse = data[1];
   * });
   *
   * @example <caption>include:samples/sinks.js</caption>
   * region_tag:logging_create_sink
   * Another example:
   */
  async createSink(
    name: string,
    config: CreateSinkRequest
  ): Promise<[Sink, LogSink]> {
    if (typeof name !== 'string') {
      throw new Error('A sink name must be provided.');
    }
    if (typeof config !== 'object') {
      throw new Error('A sink configuration object must be provided.');
    }
    if (util.isCustomType(config.destination, 'bigquery/dataset')) {
      await this.setAclForDataset_(config);
    }
    if (util.isCustomType(config.destination, 'pubsub/topic')) {
      await this.setAclForTopic_(config);
    }
    if (util.isCustomType(config.destination, 'storage/bucket')) {
      await this.setAclForBucket_(config);
    }
    const reqOpts = {
      parent: 'projects/' + this.projectId,
      sink: extend({}, config, {name}),
      uniqueWriterIdentity: config.uniqueWriterIdentity,
    };
    delete reqOpts.sink.gaxOptions;
    delete reqOpts.sink.uniqueWriterIdentity;
    await this.setProjectId(reqOpts);
    const [resp] = await this.configService.createSink(
      reqOpts,
      config.gaxOptions
    );
    const sink = this.sink(resp.name);
    sink.metadata = resp;
    return [sink, resp];
  }

  /**
   * Create an entry object.
   *
   * Using this method will not itself make any API requests. You will use
   * the object returned in other API calls, such as
   * {@link Log#write}.
   *
   * Note, [Cloud Logging Quotas and limits]{@link https://cloud.google.com/logging/quotas}
   * dictates that the maximum log entry size, including all
   * [LogEntry Resource properties]{@link https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry},
   * cannot exceed _approximately_ 256 KB.
   *
   * @see [LogEntry JSON representation]{@link https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry}
   *
   * @param {?object|?string} [resource] See a
   *     [Monitored
   * Resource](https://cloud.google.com/logging/docs/reference/v2/rest/v2/MonitoredResource).
   * @param {object|string} data The data to use as the value for this log
   *     entry.
   * @returns {Entry}
   *
   * @example
   * const {Logging} = require('@google-cloud/logging');
   * const logging = new Logging();
   *
   * const resource = {
   *   type: 'gce_instance',
   *   labels: {
   *     zone: 'global',
   *     instance_id: '3'
   *   }
   * };
   *
   * const entry = logging.entry(resource, {
   *   delegate: 'my_username'
   * });
   *
   * entry.toJSON();
   * // {
   * //   resource: {
   * //     type: 'gce_instance',
   * //     labels: {
   * //       zone: 'global',
   * //       instance_id: '3'
   * //     }
   * //   },
   * //   jsonPayload: {
   * //     delegate: 'my_username'
   * //   }
   * // }
   */
  entry(resource?: LogEntry, data?: {} | string) {
    return new Entry(resource, data);
  }

  getEntries(options?: GetEntriesRequest): Promise<GetEntriesResponse>;
  getEntries(callback: GetEntriesCallback): void;
  getEntries(options: GetEntriesRequest, callback: GetEntriesCallback): void;
  /**
   * Query object for listing entries.
   *
   * @typedef {object} GetEntriesRequest
   * @property {boolean} [autoPaginate=true] Have pagination handled
   *     automatically.
   * @property {string} [filter] An
   *     [advanced logs
   * filter](https://cloud.google.com/logging/docs/view/advanced_filters). An
   * empty filter matches all log entries.
   * @property {object} [gaxOptions] Request configuration options, outlined
   *     here: https://googleapis.github.io/gax-nodejs/global.html#CallOptions.
   * @property {string} [log] A name of the log specifying to pnly return
   *     entries from this log.
   * @property {number} [maxApiCalls] Maximum number of API calls to make.
   * @property {number} [maxResults] Maximum number of items plus prefixes to
   *     return.
   * @property {string} [orderBy] How the results should be sorted,
   *     `timestamp asc` (oldest first) and `timestamp desc` (newest first,
   *     **default**).
   * @property {number} [pageSize] Maximum number of logs to return.
   * @property {string} [pageToken] A previously-returned page token
   *     representing part of the larger set of results to view.
   */
  /**
   * @typedef {array} GetEntriesResponse
   * @property {Entry[]} 0 Array of {@link Entry} instances.
   * @property {object} 1 The full API response.
   */
  /**
   * @callback GetEntriesCallback
   * @param {?Error} err Request error, if any.
   * @param {Entry[]} entries Array of {@link Entry} instances.
   * @param {object} apiResponse The full API response.
   */
  /**
   * List the entries in your logs.
   *
   * @see [entries.list API Documentation]{@link https://cloud.google.com/logging/docs/reference/v2/rest/v2/entries/list}
   *
   * @param {GetEntriesRequest} [query] Query object for listing entries.
   * @param {GetEntriesCallback} [callback] Callback function.
   * @returns {Promise<GetEntriesResponse>}
   *
   * @example
   * const {Logging} = require('@google-cloud/logging');
   * const logging = new Logging();
   *
   * logging.getEntries((err, entries) => {
   *   // `entries` is an array of Stackdriver Logging entry objects.
   *   // See the `data` property to read the data from the entry.
   * });
   *
   * //-
   * // To control how many API requests are made and page through the results
   * // manually, set `autoPaginate` to `false`.
   * //-
   * function callback(err, entries, nextQuery, apiResponse) {
   *   if (nextQuery) {
   *     // More results exist.
   *     logging.getEntries(nextQuery, callback);
   *   }
   * }
   *
   * logging.getEntries({
   *   autoPaginate: false
   * }, callback);
   *
   * //-
   * // If the callback is omitted, we'll return a Promise.
   * //-
   * logging.getEntries().then(data => {
   *   const entries = data[0];
   * });
   *
   * @example <caption>include:samples/logs.js</caption>
   * region_tag:logging_list_log_entries
   * Another example:
   *
   * @example <caption>include:samples/logs.js</caption>
   * region_tag:logging_list_log_entries_advanced
   * Another example:
   */
  async getEntries(
    opts?: GetEntriesRequest | GetEntriesCallback
  ): Promise<GetEntriesResponse> {
    const options = opts ? (opts as GetEntriesRequest) : {};
    const reqOpts = extend(
      {
        orderBy: 'timestamp desc',
      },
      options
    );
    reqOpts.resourceNames = arrify(reqOpts.resourceNames!);
    this.projectId = await this.auth.getProjectId();
    const resourceName = 'projects/' + this.projectId;
    if (reqOpts.resourceNames.indexOf(resourceName) === -1) {
      reqOpts.resourceNames.push(resourceName);
    }
    delete reqOpts.autoPaginate;
    delete reqOpts.gaxOptions;
    const gaxOptions = extend(
      {
        autoPaginate: options!.autoPaginate,
      },
      options!.gaxOptions
    );

    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    const defaultTimeRangeFilter = `timestamp>= "${oneDayAgo.toISOString()}"`;

    if (!reqOpts.filter) {
      reqOpts.filter = defaultTimeRangeFilter;
    } else if (reqOpts.filter.toLowerCase().indexOf('timestamp') < 0) {
      reqOpts.filter = `${reqOpts.filter} AND ${defaultTimeRangeFilter}`;
    }

    const resp = await this.loggingService.listLogEntries(reqOpts, gaxOptions);
    const [entries] = resp;
    if (entries) {
      resp[0] = entries.map(Entry.fromApiResponse_);
    }
    return resp;
  }

  /**
   * List the {@link Entry} objects in your logs as a readable object
   * stream.
   *
   * @method Logging#getEntriesStream
   * @param {GetEntriesRequest} [query] Query object for listing entries.
   * @returns {ReadableStream} A readable stream that emits {@link Entry}
   *     instances.
   *
   * @example
   * const {Logging} = require('@google-cloud/logging');
   * const logging = new Logging();
   *
   * logging.getEntriesStream()
   *   .on('error', console.error)
   *   .on('data', entry => {
   *     // `entry` is a Stackdriver Logging entry object.
   *     // See the `data` property to read the data from the entry.
   *   })
   *   .on('end', function() {
   *     // All entries retrieved.
   *   });
   *
   * //-
   * // If you anticipate many results, you can end a stream early to prevent
   * // unnecessary processing and API requests.
   * //-
   * logging.getEntriesStream()
   *   .on('data', function(entry) {
   *     this.end();
   *   });
   */
  getEntriesStream(options: GetEntriesRequest = {}) {
    let requestStream: Duplex;
    const userStream = streamEvents<Duplex>(pumpify.obj());
    (userStream as AbortableDuplex).abort = () => {
      if (requestStream) {
        (requestStream as AbortableDuplex).abort();
      }
    };
    const toEntryStream = through.obj((entry, _, next) => {
      next(null, Entry.fromApiResponse_(entry));
    });
    userStream.once('reading', () => {
      this.auth.getProjectId().then(projectId => {
        this.projectId = projectId;
        if (options.log) {
          if (options.filter) {
            options.filter = `(${
              options.filter
            }) AND logName="${Log.formatName_(this.projectId, options.log)}"`;
          } else {
            options.filter = `logName="${Log.formatName_(
              this.projectId,
              options.log
            )}"`;
          }
          delete options.log;
        }
        const reqOpts = extend(
          {
            orderBy: 'timestamp desc',
          },
          options
        );
        reqOpts.resourceNames = arrify(reqOpts.resourceNames!);
        reqOpts.resourceNames.push(`projects/${this.projectId}`);
        delete reqOpts.autoPaginate;
        delete reqOpts.gaxOptions;
        const gaxOptions = extend(
          {
            autoPaginate: options.autoPaginate,
          },
          options.gaxOptions
        );

        let gaxStream: ClientReadableStream<LogEntry>;
        requestStream = streamEvents<Duplex>(through.obj());
        (requestStream as AbortableDuplex).abort = () => {
          if (gaxStream && gaxStream.cancel) {
            gaxStream.cancel();
          }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(global as any).GCLOUD_SANDBOX_ENV) {
          requestStream.once('reading', () => {
            try {
              gaxStream = this.loggingService.listLogEntriesStream(
                reqOpts,
                gaxOptions
              );
            } catch (error) {
              requestStream.destroy(error);
              return;
            }
            gaxStream
              .on('error', err => {
                requestStream.destroy(err);
              })
              .pipe(requestStream);
            return;
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (userStream as any).setPipeline(requestStream, toEntryStream);
      });
    });
    return userStream;
  }

  getLogs(options?: GetLogsRequest): Promise<GetLogsResponse>;
  getLogs(callback: GetLogsCallback): void;
  getLogs(options: GetLogsRequest, callback: GetLogsCallback): void;
  /**
   * Query object for listing entries.
   *
   * @typedef {object} GetLogsRequest
   * @property {boolean} [autoPaginate=true] Have pagination handled
   *     automatically.
   * @property {object} [gaxOptions] Request configuration options, outlined
   *     here: https://googleapis.github.io/gax-nodejs/global.html#CallOptions.
   * @property {number} [maxApiCalls] Maximum number of API calls to make.
   * @property {number} [maxResults] Maximum number of items plus prefixes to
   *     return.
   * @property {number} [pageSize] Maximum number of logs to return.
   * @property {string} [pageToken] A previously-returned page token
   *     representing part of the larger set of results to view.
   */
  /**
   * @typedef {array} GetLogsResponse
   * @property {Log[]} 0 Array of {@link Log} instances.
   * @property {object} 1 The full API response.
   */
  /**
   * @callback GetLogsCallback
   * @param {?Error} err Request error, if any.
   * @param {Log[]} logs Array of {@link Log} instances.
   * @param {object} apiResponse The full API response.
   */
  /**
   * List the entries in your logs.
   *
   * @see [logs.list API Documentation]{@link https://cloud.google.com/logging/docs/reference/v2/rest/v2/logs/list}
   *
   * @param {GetLogsRequest} [query] Query object for listing entries.
   * @param {GetLogsCallback} [callback] Callback function.
   * @returns {Promise<GetLogsResponse>}
   *
   * @example
   * const {Logging} = require('@google-cloud/logging');
   * const logging = new Logging();
   *
   * logging.getLogs((err, logs) => {
   *   // `logs` is an array of Stackdriver Logging log objects.
   * });
   *
   * //-
   * // To control how many API requests are made and page through the results
   * // manually, set `autoPaginate` to `false`.
   * //-
   * function callback(err, entries, nextQuery, apiResponse) {
   *   if (nextQuery) {
   *     // More results exist.
   *     logging.getLogs(nextQuery, callback);
   *   }
   * }
   *
   * logging.getLogs({
   *   autoPaginate: false
   * }, callback);
   *
   * //-
   * // If the callback is omitted, we'll return a Promise.
   * //-
   * logging.getLogs().then(data => {
   *   const entries = data[0];
   * });
   *
   * @example <caption>include:samples/logs.js</caption>
   * region_tag:logging_list_logs
   * Another example:
   */
  async getLogs(
    opts?: GetLogsRequest | GetLogsCallback
  ): Promise<GetLogsResponse> {
    const options = opts ? (opts as GetSinksRequest) : {};
    this.projectId = await this.auth.getProjectId();
    const reqOpts = extend({}, options, {
      parent: 'projects/' + this.projectId,
    });
    delete reqOpts.autoPaginate;
    delete reqOpts.gaxOptions;
    const gaxOptions = extend(
      {
        autoPaginate: options.autoPaginate,
      },
      options.gaxOptions
    );
    const resp = await this.loggingService.listLogs(reqOpts, gaxOptions);
    const [logs] = resp;
    if (logs) {
      resp[0] = logs.map((logName: string) => this.log(logName));
    }
    return resp;
  }

  /**
   * List the {@link Log} objects in your project as a readable object stream.
   *
   * @method Logging#getLogsStream
   * @param {GetLogsRequest} [query] Query object for listing entries.
   * @returns {ReadableStream} A readable stream that emits {@link Log}
   *     instances.
   *
   * @example
   * const {Logging} = require('@google-cloud/logging');
   * const logging = new Logging();
   *
   * logging.getLogsStream()
   *   .on('error', console.error)
   *   .on('data', log => {
   *     // `log` is a Stackdriver Logging log object.
   *   })
   *   .on('end', function() {
   *     // All logs retrieved.
   *   });
   *
   * //-
   * // If you anticipate many results, you can end a stream early to prevent
   * // unnecessary processing and API requests.
   * //-
   * logging.getLogsStream()
   *   .on('data', log => {
   *     this.end();
   *   });
   */
  getLogsStream(options: GetLogsRequest = {}) {
    options = options || {};
    let requestStream: Duplex;
    const userStream = streamEvents<Duplex>(pumpify.obj());
    (userStream as AbortableDuplex).abort = () => {
      if (requestStream) {
        (requestStream as AbortableDuplex).abort();
      }
    };
    const toLogStream = through.obj((logName, _, next) => {
      next(null, this.log(logName));
    });
    userStream.once('reading', () => {
      this.auth.getProjectId().then(projectId => {
        this.projectId = projectId;
        const reqOpts = extend({}, options, {
          parent: 'projects/' + this.projectId,
        });
        delete reqOpts.gaxOptions;
        const gaxOptions = extend(
          {
            autoPaginate: options.autoPaginate,
          },
          options.gaxOptions
        );

        let gaxStream: ClientReadableStream<Log>;
        requestStream = streamEvents<Duplex>(through.obj());
        (requestStream as AbortableDuplex).abort = () => {
          if (gaxStream && gaxStream.cancel) {
            gaxStream.cancel();
          }
        };
        requestStream.once('reading', () => {
          try {
            gaxStream = this.loggingService.listLogsStream(reqOpts, gaxOptions);
          } catch (error) {
            requestStream.destroy(error);
            return;
          }
          gaxStream
            .on('error', err => {
              requestStream.destroy(err);
            })
            .pipe(requestStream);
          return;
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (userStream as any).setPipeline(requestStream, toLogStream);
      });
    });
    return userStream;
  }

  getSinks(options?: GetSinksRequest): Promise<GetSinksResponse>;
  getSinks(callback: GetSinksCallback): void;
  getSinks(options: GetSinksRequest, callback: GetSinksCallback): void;
  /**
   * Query object for listing sinks.
   *
   * @typedef {object} GetSinksRequest
   * @property {boolean} [autoPaginate=true] Have pagination handled
   *     automatically.
   * @property {object} [gaxOptions] Request configuration options, outlined
   *     here: https://googleapis.github.io/gax-nodejs/global.html#CallOptions.
   * @property {number} [maxApiCalls] Maximum number of API calls to make.
   * @property {number} [maxResults] Maximum number of items plus prefixes to
   *     return.
   * @property {number} [pageSize] Maximum number of logs to return.
   * @property {string} [pageToken] A previously-returned page token
   *     representing part of the larger set of results to view.
   */
  /**
   * @typedef {array} GetSinksResponse
   * @property {Sink[]} 0 Array of {@link Sink} instances.
   * @property {object} 1 The full API response.
   */
  /**
   * @callback GetSinksCallback
   * @param {?Error} err Request error, if any.
   * @param {Sink[]} sinks Array of {@link Sink} instances.
   * @param {object} apiResponse The full API response.
   */
  /**
   * Get the sinks associated with this project.
   *
   * @see [projects.sinks.list API Documentation]{@link https://cloud.google.com/logging/docs/reference/v2/rest/v2/projects.sinks/list}
   *
   * @param {GetSinksRequest} [query] Query object for listing sinks.
   * @param {GetSinksCallback} [callback] Callback function.
   * @returns {Promise<GetSinksResponse>}
   *
   * @example
   * const {Logging} = require('@google-cloud/logging');
   * const logging = new Logging();
   *
   * logging.getSinks((err, sinks) => {
   *   // sinks is an array of Sink objects.
   * });
   *
   * //-
   * // If the callback is omitted, we'll return a Promise.
   * //-
   * logging.getSinks().then(data => {
   *   const sinks = data[0];
   * });
   *
   * @example <caption>include:samples/sinks.js</caption>
   * region_tag:logging_list_sinks
   * Another example:
   */
  async getSinks(
    opts?: GetSinksRequest | GetSinksCallback
  ): Promise<GetSinksResponse> {
    const options = opts ? (opts as GetSinksRequest) : {};
    this.projectId = await this.auth.getProjectId();
    const reqOpts = extend({}, options, {
      parent: 'projects/' + this.projectId,
    });
    delete reqOpts.autoPaginate;
    delete reqOpts.gaxOptions;
    const gaxOptions = extend(
      {
        autoPaginate: options.autoPaginate,
      },
      options.gaxOptions
    );
    const resp = await this.configService.listSinks(reqOpts, gaxOptions);
    const [sinks] = resp;
    if (sinks) {
      resp[0] = sinks.map((sink: LogSink) => {
        const sinkInstance = this.sink(sink.name!);
        sinkInstance.metadata = sink;
        return sinkInstance;
      });
    }
    return resp;
  }

  /**
   * Get the {@link Sink} objects associated with this project as a
   * readable object stream.
   *
   * @method Logging#getSinksStream
   * @param {GetSinksRequest} [query] Query object for listing sinks.
   * @returns {ReadableStream} A readable stream that emits {@link Sink}
   *     instances.
   *
   * @example
   * const {Logging} = require('@google-cloud/logging');
   * const logging = new Logging();
   *
   * logging.getSinksStream()
   *   .on('error', console.error)
   *   .on('data', sink => {
   *     // `sink` is a Sink object.
   *   })
   *   .on('end', function() {
   *     // All sinks retrieved.
   *   });
   *
   * //-
   * // If you anticipate many results, you can end a stream early to prevent
   * // unnecessary processing and API requests.
   * //-
   * logging.getSinksStream()
   *   .on('data', function(sink) {
   *     this.end();
   *   });
   */
  getSinksStream(options: GetSinksRequest) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    options = options || {};
    let requestStream: Duplex;
    const userStream = streamEvents<Duplex>(pumpify.obj());
    (userStream as AbortableDuplex).abort = () => {
      if (requestStream) {
        (requestStream as AbortableDuplex).abort();
      }
    };
    const toSinkStream = through.obj((sink, _, next) => {
      const sinkInstance = self.sink(sink.name);
      sinkInstance.metadata = sink;
      next(null, sinkInstance);
    });
    userStream.once('reading', () => {
      this.auth.getProjectId().then(projectId => {
        this.projectId = projectId;
        const reqOpts = extend({}, options, {
          parent: 'projects/' + self.projectId,
        });
        delete reqOpts.gaxOptions;
        const gaxOptions = extend(
          {
            autoPaginate: options.autoPaginate,
          },
          options.gaxOptions
        );

        let gaxStream: ClientReadableStream<LogSink>;
        requestStream = streamEvents<Duplex>(through.obj());
        (requestStream as AbortableDuplex).abort = () => {
          if (gaxStream && gaxStream.cancel) {
            gaxStream.cancel();
          }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(global as any).GCLOUD_SANDBOX_ENV) {
          requestStream.once('reading', () => {
            try {
              gaxStream = this.configService.listSinksStream(
                reqOpts,
                gaxOptions
              );
            } catch (error) {
              requestStream.destroy(error);
              return;
            }
            gaxStream
              .on('error', err => {
                requestStream.destroy(err);
              })
              .pipe(requestStream);
            return;
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (userStream as any).setPipeline(requestStream, toSinkStream);
      });
    });
    return userStream;
  }

  /**
   * Get a reference to a Stackdriver Logging log.
   *
   * @see [Log Overview]{@link https://cloud.google.com/logging/docs/reference/v2/rest/v2/projects.logs}
   *
   * @param {string} name Name of the existing log.
   * @param {object} [options] Configuration object.
   * @param {boolean} [options.removeCircular] Replace circular references in
   *     logged objects with a string value, `[Circular]`. (Default: false)
   * @returns {Log}
   *
   * @example
   * const {Logging} = require('@google-cloud/logging');
   * const logging = new Logging();
   * const log = logging.log('my-log');
   */
  log(name: string, options?: LogOptions) {
    return new Log(this, name, options);
  }

  /**
   * Get a reference to a Stackdriver Logging sink.
   *
   * @see [Sink Overview]{@link https://cloud.google.com/logging/docs/reference/v2/rest/v2/projects.sinks}
   *
   * @param {string} name Name of the existing sink.
   * @returns {Sink}
   *
   * @example
   * const {Logging} = require('@google-cloud/logging');
   * const logging = new Logging();
   * const sink = logging.sink('my-sink');
   */
  sink(name: string) {
    return new Sink(this, name);
  }

  /**
   * Funnel all API requests through this method, to be sure we have a project
   * ID.
   *
   * @param {object} config Configuration object.
   * @param {object} config.gaxOpts GAX options.
   * @param {function} config.method The gax method to call.
   * @param {object} config.reqOpts Request options.
   * @param {function} [callback] Callback function.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request<TResponse = any>(
    config: RequestConfig,
    callback?: RequestCallback<TResponse>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const isStreamMode = !callback;
    let gaxStream: ClientReadableStream<LogSink | LogEntry>;
    let stream: Duplex;
    if (isStreamMode) {
      stream = streamEvents<Duplex>(through.obj());
      (stream as AbortableDuplex).abort = () => {
        if (gaxStream && gaxStream.cancel) {
          gaxStream.cancel();
        }
      };
      stream.once('reading', makeRequestStream);
    } else {
      makeRequestCallback();
    }
    function prepareGaxRequest(callback: GaxRequestCallback): void {
      self.auth.getProjectId((err, projectId) => {
        if (err) {
          callback(err);
          return;
        }
        self.projectId = projectId!;
        let gaxClient = self.api[config.client];
        if (!gaxClient) {
          // Lazily instantiate client.
          gaxClient = new v2[config.client](self.options);
          self.api[config.client] = gaxClient;
        }
        let reqOpts = extend(true, {}, config.reqOpts);
        reqOpts = replaceProjectIdToken(reqOpts, projectId!);
        const requestFn = gaxClient[config.method].bind(
          gaxClient,
          reqOpts,
          config.gaxOpts
        );
        callback(null, requestFn);
      });
    }
    function makeRequestCallback() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((global as any).GCLOUD_SANDBOX_ENV) {
        return;
      }
      prepareGaxRequest((err, requestFn) => {
        if (err) {
          callback!(err);
          return;
        }
        requestFn!(callback);
      });
    }
    function makeRequestStream() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((global as any).GCLOUD_SANDBOX_ENV) {
        return through.obj();
      }
      prepareGaxRequest((err, requestFn) => {
        if (err) {
          stream.destroy(err);
          return;
        }
        gaxStream = requestFn!();
        gaxStream
          .on('error', err => {
            stream.destroy(err);
          })
          .pipe(stream);
      });
      return;
    }
    return stream!;
  }

  /**
   * This method is called when creating a sink with a Bucket destination. The
   * bucket must first grant proper ACL access to the Stackdriver Logging
   * account.
   *
   * The parameters are the same as what {@link Logging#createSink} accepts.
   *
   * @private
   */
  async setAclForBucket_(config: CreateSinkRequest) {
    const bucket = config.destination as Bucket;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (bucket.acl.owners as any).addGroup('cloud-logs@google.com');
    config.destination = 'storage.googleapis.com/' + bucket.name;
  }

  /**
   * This method is called when creating a sink with a Dataset destination. The
   * dataset must first grant proper ACL access to the Stackdriver Logging
   * account.
   *
   * The parameters are the same as what {@link Logging#createSink} accepts.
   *
   * @private
   */
  async setAclForDataset_(config: CreateSinkRequest) {
    const dataset = config.destination as Dataset;
    const [metadata] = await dataset.getMetadata();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const access = ([] as any[]).slice.call(arrify(metadata.access));
    access.push({
      role: 'WRITER',
      groupByEmail: 'cloud-logs@google.com',
    });
    await dataset.setMetadata({
      access,
    });
    const baseUrl = 'bigquery.googleapis.com';
    const pId = (dataset.parent as BigQuery).projectId;
    const dId = dataset.id;
    config.destination = `${baseUrl}/projects/${pId}/datasets/${dId}`;
  }

  /**
   * This method is called when creating a sink with a Topic destination. The
   * topic must first grant proper ACL access to the Stackdriver Logging
   * account.
   *
   * The parameters are the same as what {@link Logging#createSink} accepts.
   *
   * @private
   */
  async setAclForTopic_(config: CreateSinkRequest) {
    const topic = config.destination as Topic;
    const [policy] = await topic.iam.getPolicy();
    policy.bindings = arrify(policy.bindings!);
    policy!.bindings.push({
      role: 'roles/pubsub.publisher',
      members: ['serviceAccount:cloud-logs@system.gserviceaccount.com'],
    });
    await topic.iam.setPolicy(policy);
    const baseUrl = 'pubsub.googleapis.com';
    const topicName = topic.name;
    config.destination = `${baseUrl}/${topicName}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async setProjectId(reqOpts: {}) {
    if (this.projectId === '{{projectId}}') {
      this.projectId = await this.auth.getProjectId();
    }
    reqOpts = replaceProjectIdToken(reqOpts, this.projectId);
  }
}

/*! Developer Documentation
 * All async methods (except for streams) will execute a callback in the event
 * that a callback is provided.
 */
callbackifyAll(Logging, {
  exclude: ['request'],
});

/*! Developer Documentation
 *
 * These methods can be auto-paginated.
 */
paginator.extend(Logging, ['getEntries', 'getLogs', 'getSinks']);

/**
 * {@link Entry} class.
 *
 * @name Logging.Entry
 * @see Entry
 * @type {Constructor}
 */
export {Entry};

/**
 * {@link Log} class.
 *
 * @name Logging.Log
 * @see Log
 * @type {Constructor}
 */
export {Log};
export {Severity};
export {SeverityNames};

/**
 * {@link Sink} class.
 *
 * @name Logging.Sink
 * @see Sink
 * @type {Constructor}
 */
export {Sink};

/**
 * {@link MonitoredResource} class.
 *
 * @name Logging.MonitoredResource
 * @see MonitoredResource
 * @type {Interface}
 */
export {MonitoredResource};

/**
 * The default export of the `@google-cloud/logging` package is the
 * {@link Logging} class.
 *
 * See {@link Logging} and {@link ClientConfig} for client methods and
 * configuration options.
 *
 * @module {Constructor} @google-cloud/logging
 * @alias nodejs-logging
 *
 * @example <caption>Install the client library with <a href="https://www.npmjs.com/">npm</a>:</caption>
 * npm install --save @google-cloud/logging
 *
 * @example <caption>Import the client library</caption>
 * const {Logging} = require('@google-cloud/logging');
 *
 * @example <caption>Create a client that uses <a href="https://cloud.google.com/docs/authentication/production#providing_credentials_to_your_application">Application Default Credentials (ADC)</a>:</caption>
 * const logging = new Logging();
 *
 * @example <caption>Create a client with <a href="https://cloud.google.com/docs/authentication/production#obtaining_and_providing_service_account_credentials_manually">explicit credentials</a>:</caption>
 * const logging = new Logging({ projectId: 'your-project-id', keyFilename: '/path/to/keyfile.json'});
 *
 * @example <caption>include:samples/quickstart.js</caption>
 * region_tag:logging_quickstart
 * Full quickstart example:
 */
export {Logging};

/**
 * Reference to the low-level auto-generated clients for the V2 Logging service.
 *
 * @type {object}
 * @property {constructor} LoggingServiceV2Client
 *   Reference to {@link v2.LoggingServiceV2Client}
 * @property {constructor} ConfigServiceV2Client
 *   Reference to {@link v2.ConfigServiceV2Client}
 * @property {constructor} MetricsServiceV2Client
 *   Reference to {@link v2.MetricsServiceV2Client}
 */
module.exports.v2 = v2;
import * as protos from '../protos/protos';
export {protos};
export {v2};
