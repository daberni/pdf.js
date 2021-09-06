/* Copyright 2016 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { AppOptions } from "./app_options.js";
import { PDFViewerApplication } from "./app.js";

/* eslint-disable-next-line no-unused-vars */
const pdfjsVersion =
  typeof PDFJSDev !== "undefined" ? PDFJSDev.eval("BUNDLE_VERSION") : void 0;
/* eslint-disable-next-line no-unused-vars */
const pdfjsBuild =
  typeof PDFJSDev !== "undefined" ? PDFJSDev.eval("BUNDLE_BUILD") : void 0;

window.PDFViewerApplication = PDFViewerApplication;
window.PDFViewerApplicationOptions = AppOptions;

if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("CHROME")) {
  var defaultUrl; // eslint-disable-line no-var

  (function rewriteUrlClosure() {
    // Run this code outside DOMContentLoaded to make sure that the URL
    // is rewritten as soon as possible.
    const queryString = document.location.search.slice(1);
    const m = /(^|&)file=([^&]*)/.exec(queryString);
    defaultUrl = m ? decodeURIComponent(m[2]) : "";

    // Example: chrome-extension://.../http://example.com/file.pdf
    const humanReadableUrl = "/" + defaultUrl + location.hash;
    history.replaceState(history.state, "", humanReadableUrl);
    if (top === window) {
      // eslint-disable-next-line no-undef
      chrome.runtime.sendMessage("showPageAction");
    }
  })();
}

if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("MOZCENTRAL")) {
  require("./firefoxcom.js");
  require("./firefox_print_service.js");
}
if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("GENERIC")) {
  require("./genericcom.js");
}
if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("CHROME")) {
  require("./chromecom.js");
}
if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("CHROME || GENERIC")) {
  require("./pdf_print_service.js");
}

function webViewerLoad() {
  const dispatchEvent = () => {
    const event = document.createEvent("CustomEvent");
    event.initCustomEvent("PDFViewerInitialized", true, true);
    try {
      // Attempt to dispatch the event at the embedding `document`,
      // in order to support cases where the viewer is embedded in
      // a *dynamically* created <iframe> element.
      parent.document.dispatchEvent(event);
    } catch (ex) {
      // The viewer could be in e.g. a cross-origin <iframe> element,
      // fallback to dispatching the event at the current `document`.
      console.error(`PDFViewerInitialized: ${ex}`);
      document.dispatchEvent(event);
    }
  };

  if (typeof PDFJSDev === "undefined" || !PDFJSDev.test("PRODUCTION")) {
    Promise.all([
      import("pdfjs-web/genericcom.js"),
      import("pdfjs-web/pdf_print_service.js"),
    ]).then(function ([genericCom, pdfPrintService]) {
      dispatchEvent();
    });
  } else {
    if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("CHROME")) {
      AppOptions.set("defaultUrl", defaultUrl);
    }
    dispatchEvent();
  }
}

// Block the "load" event until all pages are loaded, to ensure that printing
// works in Firefox; see https://bugzilla.mozilla.org/show_bug.cgi?id=1618553
if (document.blockUnblockOnload) {
  document.blockUnblockOnload(true);
}

if (
  document.readyState === "interactive" ||
  document.readyState === "complete"
) {
  webViewerLoad();
} else {
  document.addEventListener("DOMContentLoaded", webViewerLoad, true);
}

export { PDFViewerApplication, AppOptions as PDFViewerApplicationOptions };
