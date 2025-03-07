/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */
//

import groupBy from "lodash/groupBy";
import uniqBy from "lodash/uniqBy";
import { createSelector } from "reselect";

import {
  getViewport,
  getSource,
  getSelectedSource,
  getSelectedSourceWithContent,
  getBreakpointPositions,
  getBreakpointPositionsForSource,
} from "../selectors";
import { getVisibleBreakpoints, getVisibleRequestedBreakpoints } from "./visibleBreakpoints";
import { sortSelectedLocations } from "../utils/location";
import { getLineText } from "../utils/source";
import { features } from "ui/utils/prefs";

function contains(location, range) {
  return (
    location.line >= range.start.line &&
    location.line <= range.end.line &&
    (!location.column ||
      (location.column >= range.start.column && location.column <= range.end.column))
  );
}

function groupBreakpoints(breakpoints, selectedSource) {
  if (!breakpoints) {
    return {};
  }

  const map = groupBy(breakpoints, breakpoint => breakpoint.location.line);

  for (const line in map) {
    map[line] = groupBy(map[line], breakpoint => breakpoint.location.column);
  }

  return map;
}

function findBreakpoint(location, breakpointMap) {
  const { line, column } = location;
  const breakpoints = breakpointMap[line] && breakpointMap[line][column];

  if (breakpoints) {
    return breakpoints[0];
  }
}

function filterByLineCount(positions, selectedSource) {
  const lineCount = {};

  for (const { line } of positions) {
    if (!lineCount[line]) {
      lineCount[line] = 0;
    }

    lineCount[line] = lineCount[line] + 1;
  }

  return positions.filter(({ line }) => lineCount[line] > 1);
}

// filter out positions that are not being shown
function filterVisible(positions, selectedSource, viewport) {
  return positions.filter(location => {
    return viewport && contains(location, viewport);
  });
}

// filter out positions that are not in the map
function filterByBreakpoints(positions, selectedSource, breakpointMap) {
  return positions.filter(position => {
    return breakpointMap[position.line];
  });
}

// Filters out breakpoints to the right of the line. (bug 1552039)
function filterInLine(positions, selectedSource, selectedContent) {
  return positions.filter(position => {
    const lineText = getLineText(selectedSource.id, selectedContent, position.line);

    return lineText.length >= (position.column || 0);
  });
}

function formatPositions(positions, selectedSource, breakpointMap) {
  return positions.map(location => {
    return {
      location,
      breakpoint: findBreakpoint(location, breakpointMap),
    };
  });
}

function convertToList(breakpointPositions) {
  return [].concat(...Object.values(breakpointPositions));
}

export function getColumnBreakpoints(
  breakpoints,
  requestedBreakpoints,
  viewport,
  selectedSource,
  breakpointPositions
) {
  if (!selectedSource) {
    return [];
  }

  // We only want to show a column breakpoint if several conditions are matched
  // - it is the first breakpoint to appear at an the original location
  // - the position is in the current viewport
  // - there is atleast one other breakpoint on that line
  // - there is a breakpoint on that line
  const allBreakpoints = [...breakpoints, ...requestedBreakpoints];

  // NOTE: column breakpoints are disabled by default because
  // we should first verify if the results make sense
  let positions;
  if (features.columnBreakpoints) {
    positions = breakpointPositions;
  } else {
    // collect all breakpoint positions but make sure that we don't have 2 positions
    // for the same line in the same source
    positions = uniqBy(
      allBreakpoints.map(bp => bp.location),
      ({ sourceId, line }) => `${sourceId}:${line}`
    );
  }
  const breakpointMap = groupBreakpoints(allBreakpoints, selectedSource);
  positions = filterVisible(positions, selectedSource, viewport);
  positions = filterInLine(positions, selectedSource, selectedSource.content);
  positions = filterByBreakpoints(positions, selectedSource, breakpointMap);

  return formatPositions(positions, selectedSource, breakpointMap);
}

const getVisibleBreakpointPositions = createSelector(
  getSelectedSource,
  getBreakpointPositions,
  (source, positions) => {
    if (!source) {
      return [];
    }

    const sourcePositions = positions[source.id];
    if (!sourcePositions) {
      return [];
    }

    return convertToList(sourcePositions);
  }
);

export const visibleColumnBreakpoints = createSelector(
  getVisibleBreakpoints,
  getVisibleRequestedBreakpoints,
  getViewport,
  getSelectedSourceWithContent,
  getVisibleBreakpointPositions,
  getColumnBreakpoints
);

export function getFirstBreakpointPosition(state, { line, sourceId }) {
  const positions = getBreakpointPositionsForSource(state, sourceId);
  const source = getSource(state, sourceId);

  if (!source || !positions) {
    return;
  }

  return sortSelectedLocations(convertToList(positions), source).find(
    location => location.line == line
  );
}
