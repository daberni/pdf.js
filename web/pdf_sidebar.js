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

import { PresentationModeState, SidebarView } from "./ui_utils.js";
import { RenderingStates } from "./pdf_rendering_queue.js";

/**
 * @typedef {Object} PDFSidebarOptions
 * @property {PDFSidebarElements} elements - The DOM elements.
 * @property {PDFViewer} pdfViewer - The document viewer.
 * @property {PDFThumbnailViewer} pdfThumbnailViewer - The thumbnail viewer.
 * @property {EventBus} eventBus - The application event bus.
 * @property {IL10n} l10n - The localization service.
 */

/**
 * @typedef {Object} PDFSidebarElements
 * @property {HTMLDivElement} outerContainer - The outer container
 *   (encasing both the viewer and sidebar elements).
 * @property {HTMLDivElement} viewerContainer - The viewer container
 *   (in which the viewer element is placed).
 * @property {HTMLDivElement} thumbnailView - The container in which
 *   the thumbnails are placed.
 */

class PDFSidebar {
  /**
   * @param {PDFSidebarOptions} options
   */
  constructor({ elements, pdfViewer, pdfThumbnailViewer, eventBus, l10n }) {
    this.isOpen = false;
    this.active = SidebarView.THUMBS;
    this.isInitialViewSet = false;

    /**
     * Callback used when the sidebar has been opened/closed, to ensure that
     * the viewers (PDFViewer/PDFThumbnailViewer) are updated correctly.
     */
    this.onToggled = null;

    this.pdfViewer = pdfViewer;
    this.pdfThumbnailViewer = pdfThumbnailViewer;

    this.outerContainer = elements.outerContainer;
    this.viewerContainer = elements.viewerContainer;

    this.thumbnailView = elements.thumbnailView;

    this.eventBus = eventBus;
    this.l10n = l10n;

    this._addEventListeners();
  }

  reset() {
    this.isInitialViewSet = false;

    this.switchView(SidebarView.THUMBS);
  }

  /**
   * @type {number} One of the values in {SidebarView}.
   */
  get visibleView() {
    return this.isOpen ? this.active : SidebarView.NONE;
  }

  get isThumbnailViewVisible() {
    return this.isOpen && this.active === SidebarView.THUMBS;
  }

  get isOutlineViewVisible() {
    return this.isOpen && this.active === SidebarView.OUTLINE;
  }

  get isAttachmentsViewVisible() {
    return this.isOpen && this.active === SidebarView.ATTACHMENTS;
  }

  get isLayersViewVisible() {
    return this.isOpen && this.active === SidebarView.LAYERS;
  }

  /**
   * @param {number} view - The sidebar view that should become visible,
   *                        must be one of the values in {SidebarView}.
   */
  setInitialView(view = SidebarView.NONE) {
    if (this.isInitialViewSet) {
      return;
    }
    this.isInitialViewSet = true;

    // If the user has already manually opened the sidebar, immediately closing
    // it would be bad UX; also ignore the "unknown" sidebar view value.
    if (view === SidebarView.NONE || view === SidebarView.UNKNOWN) {
      this._dispatchEvent();
      return;
    }
    // Prevent dispatching two back-to-back `sidebarviewchanged` events,
    // since `this._switchView` dispatched the event if the view changed.
    if (!this._switchView(view, /* forceOpen */ true)) {
      this._dispatchEvent();
    }
  }

  /**
   * @param {number} view - The sidebar view that should be switched to,
   *                        must be one of the values in {SidebarView}.
   * @param {boolean} [forceOpen] - Ensure that the sidebar is open.
   *                                The default value is `false`.
   */
  switchView(view, forceOpen = false) {
    this._switchView(view, forceOpen);
  }

  /**
   * @returns {boolean} Indicating if `this._dispatchEvent` was called.
   * @private
   */
  _switchView(view, forceOpen = false) {
    const isViewChanged = view !== this.active;
    let shouldForceRendering = false;

    switch (view) {
      case SidebarView.NONE:
        if (this.isOpen) {
          this.close();
          return true; // Closing will trigger rendering and dispatch the event.
        }
        return false;
      case SidebarView.THUMBS:
        if (this.isOpen && isViewChanged) {
          shouldForceRendering = true;
        }
        break;
      default:
        console.error(`PDFSidebar._switchView: "${view}" is not a valid view.`);
        return false;
    }
    // Update the active view *after* it has been validated above,
    // in order to prevent setting it to an invalid state.
    this.active = view;

    this.thumbnailView.classList.toggle("hidden", view !== SidebarView.THUMBS);

    if (forceOpen && !this.isOpen) {
      this.open();
      return true; // Opening will trigger rendering and dispatch the event.
    }
    if (shouldForceRendering) {
      this._updateThumbnailViewer();
      this._forceRendering();
    }
    if (isViewChanged) {
      this._dispatchEvent();
    }
    return isViewChanged;
  }

  open() {
    if (this.isOpen) {
      return;
    }
    this.isOpen = true;

    this.outerContainer.classList.add("sidebarMoving", "sidebarOpen");

    if (this.active === SidebarView.THUMBS) {
      this._updateThumbnailViewer();
    }
    this._forceRendering();
    this._dispatchEvent();
  }

  close() {
    if (!this.isOpen) {
      return;
    }
    this.isOpen = false;

    this.outerContainer.classList.add("sidebarMoving");
    this.outerContainer.classList.remove("sidebarOpen");

    this._forceRendering();
    this._dispatchEvent();
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * @private
   */
  _dispatchEvent() {
    this.eventBus.dispatch("sidebarviewchanged", {
      source: this,
      view: this.visibleView,
    });
  }

  /**
   * @private
   */
  _forceRendering() {
    if (this.onToggled) {
      this.onToggled();
    } else {
      // Fallback
      this.pdfViewer.forceRendering();
      this.pdfThumbnailViewer.forceRendering();
    }
  }

  /**
   * @private
   */
  _updateThumbnailViewer() {
    const { pdfViewer, pdfThumbnailViewer } = this;

    // Use the rendered pages to set the corresponding thumbnail images.
    const pagesCount = pdfViewer.pagesCount;
    for (let pageIndex = 0; pageIndex < pagesCount; pageIndex++) {
      const pageView = pdfViewer.getPageView(pageIndex);
      if (pageView?.renderingState === RenderingStates.FINISHED) {
        const thumbnailView = pdfThumbnailViewer.getThumbnail(pageIndex);
        thumbnailView.setImage(pageView);
      }
    }
    pdfThumbnailViewer.scrollThumbnailIntoView(pdfViewer.currentPageNumber);
  }

  /**
   * @private
   */
  _addEventListeners() {
    this.viewerContainer.addEventListener("transitionend", evt => {
      if (evt.target === this.viewerContainer) {
        this.outerContainer.classList.remove("sidebarMoving");
      }
    });

    // Update the thumbnailViewer, if visible, when exiting presentation mode.
    this.eventBus._on("presentationmodechanged", evt => {
      if (
        evt.state === PresentationModeState.NORMAL &&
        this.isThumbnailViewVisible
      ) {
        this._updateThumbnailViewer();
      }
    });
  }
}

export { PDFSidebar };
