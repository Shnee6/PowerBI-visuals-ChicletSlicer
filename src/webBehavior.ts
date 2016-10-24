/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
    // d3
    import Selection = d3.Selection;
    import UpdateSelection = d3.selection.Update;
    import ISemanticFilter = data.ISemanticFilter;

    // powerbi.data
    import Selector = powerbi.data.Selector;
    import ISQExpr = powerbi.data.ISQExpr;

    // powerbi.visuals
    import IInteractiveBehavior = powerbi.visuals.IInteractiveBehavior;
    import SelectableDataPoint = powerbi.visuals.SelectableDataPoint;
    import IInteractivityService = powerbi.visuals.IInteractivityService;
    import ISelectionHandler = powerbi.visuals.ISelectionHandler;

    export interface ChicletSlicerBehaviorOptions {
        slicerItemContainers: Selection<SelectableDataPoint>;
        slicerItemLabels: Selection<any>;
        slicerItemInputs: Selection<any>;
        slicerClear: Selection<any>;
        dataPoints: ChicletSlicerDataPoint[];
        interactivityService: IInteractivityService;
        slicerSettings: ChicletSlicerSettings;
        isSelectionLoaded: boolean;
        identityFields: ISQExpr[];
    }

    export class ChicletSlicerWebBehavior implements IInteractiveBehavior {
        private slicers: Selection<SelectableDataPoint>;
        private slicerItemLabels: Selection<any>;
        private slicerItemInputs: Selection<any>;
        private interactivityService: IInteractivityService;
        private slicerSettings: ChicletSlicerSettings;
        private options: ChicletSlicerBehaviorOptions;

        /**
         * Public for testability.
         */
        public dataPoints: ChicletSlicerDataPoint[];

        public bindEvents(options: ChicletSlicerBehaviorOptions, selectionHandler: ISelectionHandler): void {
            var slicers = this.slicers = options.slicerItemContainers;

            this.slicerItemLabels = options.slicerItemLabels;
            this.slicerItemInputs = options.slicerItemInputs;

            var slicerClear = options.slicerClear;

            this.dataPoints = options.dataPoints;
            this.interactivityService = options.interactivityService;
            this.slicerSettings = options.slicerSettings;
            this.options = options;

            if (!this.options.isSelectionLoaded) {
                this.loadSelection(selectionHandler);
            }

            slicers.on("mouseover", (d: ChicletSlicerDataPoint) => {
                if (d.selectable) {
                    d.mouseOver = true;
                    d.mouseOut = false;

                    this.renderMouseover();
                }
            });

            slicers.on("mouseout", (d: ChicletSlicerDataPoint) => {
                if (d.selectable) {
                    d.mouseOver = false;
                    d.mouseOut = true;

                    this.renderMouseover();
                }
            });

            slicers.on("click", (dataPoint: ChicletSlicerDataPoint, index) => {
                if (!dataPoint.selectable) {
                    return;
                }

                (d3.event as MouseEvent).preventDefault();

                var settings: ChicletSlicerSettings = this.slicerSettings;

                var selectedIndexes: number[] = jQuery.map(
                    this.dataPoints,
                    (dataPoint: ChicletSlicerDataPoint, index: number) => {
                        if (dataPoint.selected) {
                            return index;
                        };
                    });

                if ((d3.event as MouseEvent).altKey && settings.general.multiselect) {
                    var selIndex = selectedIndexes.length > 0
                        ? (selectedIndexes[selectedIndexes.length - 1])
                        : 0;

                    if (selIndex > index) {
                        var temp = index;
                        index = selIndex;
                        selIndex = temp;
                    }

                    selectionHandler.handleClearSelection();

                    for (var i = selIndex; i <= index; i++) {
                        selectionHandler.handleSelection(this.dataPoints[i], true /* isMultiSelect */);
                    }
                }
                else if (((d3.event as MouseEvent).ctrlKey || (d3.event as MouseEvent).metaKey) && settings.general.multiselect) {
                    selectionHandler.handleSelection(dataPoint, true /* isMultiSelect */);
                }
                else {
                    selectionHandler.handleSelection(dataPoint, false /* isMultiSelect */);
                }

                this.saveSelection(selectionHandler);
            });

            slicerClear.on("click", (d: SelectableDataPoint) => {
                selectionHandler.handleClearSelection();
                this.saveSelection(selectionHandler);
            });
        }

        public loadSelection(selectionHandler: ISelectionHandler): void {
            selectionHandler.handleClearSelection();
            var savedSelectionIds = this.slicerSettings.general.getSavedSelection();
            if (savedSelectionIds.length) {
                var selectedDataPoints = this.dataPoints.filter(d => savedSelectionIds.some(x => (d.identity as any).getKey() === x));
                selectedDataPoints.forEach(x => selectionHandler.handleSelection(x, true));
                // selectionHandler.persistSelectionFilter(chicletSlicerProps.filterPropertyIdentifier); // selectionHandler doesn't support cross-filtering for now.
            }
        }

        public static getFilterFromSelectors(
            selectedIds: ISelectionId[],
            isSelectionModeInverted: boolean,
            identityFields: ISQExpr | ISQExpr[]): ISemanticFilter {

            var selectors: Selector[] = [],
                filter: ISemanticFilter;

            // if (selectedIds.length > 0) {
            //     selectors = _.chain(selectedIds)
            //         .filter((value: ISelectionId) => value.hasIdentity())
            //         .map((value: ISelectionId) => value.getSelector())
            //         .value();
            // }

            // if (selectors.length) {
            //     filter = Selector.filterFromSelector(selectors, isSelectionModeInverted);
            // } else if (identityFields) {
            //     filter = SemanticFilter.getAnyValueFilter(<ISQExpr[]>identityFields);
            // }

            return filter;
        }

        public saveSelection(selectionHandler: ISelectionHandler): void {
            var filter: ISemanticFilter,
                selectedIds: ISelectionId[],
                selectionIdKeys: string[],
                identityFields: ISQExpr[];

            selectedIds = <ISelectionId[]>(<any>selectionHandler).selectedIds;

            identityFields = this.options ? this.options.identityFields : [];

            filter = ChicletSlicerWebBehavior.getFilterFromSelectors(
                selectedIds,
                this.interactivityService.isSelectionModeInverted(),
                identityFields);

            selectionIdKeys = selectedIds.map(x => (x as any).getKey());

            this.slicerSettings.general.setSavedSelection(filter, selectionIdKeys);
        }

        public renderSelection(hasSelection: boolean): void {
            if (!hasSelection && !this.interactivityService.isSelectionModeInverted()) {
                this.slicers.style('background', this.slicerSettings.slicerText.unselectedColor);
            }
            else {
                this.styleSlicerInputs(this.slicers, hasSelection);
            }
        }

        private renderMouseover(): void {
            this.slicerItemLabels.style({
                'color': (d: ChicletSlicerDataPoint) => {
                    if (d.mouseOver)
                        return this.slicerSettings.slicerText.hoverColor;

                    if (d.mouseOut) {
                        if (d.selected)
                            return this.slicerSettings.slicerText.fontColor;
                        else
                            return this.slicerSettings.slicerText.fontColor;
                    }
                }
            });
        }

        public styleSlicerInputs(slicers: Selection<any>, hasSelection: boolean) {
            var settings = this.slicerSettings;
            var selectedItems = [];
            slicers.each(function (d: ChicletSlicerDataPoint) {
                // get selected items
                if (d.selectable && d.selected) {
                    selectedItems.push(d);
                }

                d3.select(this).style({
                    'background': d.selectable ? (d.selected ? settings.slicerText.selectedColor : settings.slicerText.unselectedColor)
                        : settings.slicerText.disabledColor
                });

                d3.select(this).classed('slicerItem-disabled', !d.selectable);
            });
        }
    }
}
