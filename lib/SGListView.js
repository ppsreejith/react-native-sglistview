import React, { PropTypes, Component } from 'react';
import { ListView, ScrollView } from 'react-native';
import SGListViewCell from './SGListViewCell';

/**
 * Some methods are stored here. The benefit of doing so are:
 * 1. The methods are truly private from the outside (unliked the _methodName pattern)
 * 2. The methods aren't instantiated with every instance
 * 3. They're static and hold 0 state
 * 4. Keeps the class size smaller
 */
const PrivateMethods = {
  captureReferenceFor(cellData, sectionId, rowId, row) {
    if (cellData[sectionId] === undefined) {
      cellData[sectionId] = {};
    }

    cellData[sectionId][rowId] = row; // Capture the reference
  },

  /**
   * Go through the changed rows and update the cell with their new visibility state
   */
  updateCellsVisibility(cellData, changedRows) {
    for (const section in changedRows) {
      if (changedRows.hasOwnProperty(section)) { // Good JS hygiene check
        const currentSection = changedRows[section];

        for (const row in currentSection) {
          if (currentSection.hasOwnProperty(row)) { // Good JS hygiene check
            const currentCell = cellData[section][row];
            const currentCellVisibility = currentSection[row];

            // Set the cell's new visibility state
            if (currentCell && currentCell.setVisibility) {
              currentCell.setVisibility(currentCellVisibility);
            }
          }
        }
      }
    }
  },

  /**
   * When the user is scrolling up or down - load the cells in the future to make it
   * so the user doesn't see any flashing
   */
  updateCellsPremptively(props, cellData, visibleRows) {
    if (!props.premptiveLoading) {
      return; // No need to run is preemptive loading is 0 or false
    }

    if (!cellData.premptiveLoadedCells) {
      cellData.premptiveLoadedCells = [];
    }

    // Get the first and last visible rows
    let firstVisibleRow;
    let lastVisibleRow;
    let firstVisibleSection;
    let lastVisibleSection;

    for (const section in visibleRows) {
      if (visibleRows.hasOwnProperty(section)) { // Good JS hygiene check
        for (const row in visibleRows[section]) {
          if (firstVisibleRow === undefined) {
            firstVisibleSection = section;
            firstVisibleRow = Number(row);
          } else {
            lastVisibleSection = section;
            lastVisibleRow = Number(row);
          }

          /*
           * Dont consider a cell preemptiveloaded if it is touched by default visibility logic.
           */
          const currentCell = cellData[section][row];
          if (cellData.premptiveLoadedCells) {
            const i = cellData.premptiveLoadedCells.indexOf(currentCell);
            if (i >= 0) {
              cellData.premptiveLoadedCells.splice(i, 1);
            }
          }
        }
      }
    }

    // Figure out if we're scrolling up or down
    const isScrollingUp = cellData.firstVisibleRow > firstVisibleRow;
    const isScrollingDown = cellData.lastVisibleRow < lastVisibleRow;

    let scrollDirectionChanged;
    if (isScrollingUp && cellData.lastScrollDirection === 'down') {
      scrollDirectionChanged = true;
    } else if (isScrollingDown && cellData.lastScrollDirection === 'up') {
      scrollDirectionChanged = true;
    }

    // remove the other side's preemptive cells
    if (scrollDirectionChanged) {
      let cell = cellData.premptiveLoadedCells.pop();

      while (cell != undefined) {
        cell.setVisibility(false);
        cell = cellData.premptiveLoadedCells.pop();
      }
    }

    // Preemptively set cells
    for (let i = 1; i <= props.premptiveLoading; i++) {
      let cell;

      if (isScrollingUp) {
        cell = cellData[firstVisibleSection][firstVisibleRow - i];
      } else if (isScrollingDown) {
        cell = cellData[lastVisibleSection][lastVisibleRow + i];
      }

      if (cell) {
        cell.setVisibility(true);
        cellData.premptiveLoadedCells.push(cell);
      } else {
        break;
      }
    }

    cellData.firstVisibleRow = firstVisibleRow; // cache the first seen row
    cellData.lastVisibleRow = lastVisibleRow; // cache the last seen row

    if (isScrollingUp) {
      cellData.lastScrollDirection = 'up';
    } else if (isScrollingDown) {
      cellData.lastScrollDirection = 'down';
    }
  },
};


export default class extends Component{

  /**
   * Object Lifecycle Methods
   */

  /**
   * View Lifecycle Methods
   */
    constructor(props) {
	super(props);
    }

  componentWillMount() {
    // This object keeps track of the cell data.
    // NOTE: We don't want to trigger a render pass when updating the data here
    //       so we don't store this information in this.state.
    this.cellData = {
      lastVisibleRow: 0, // keep track of the last row rendered
    };
  }

  onChangeVisibleRows(visibleRows, changedRows) {
      // Update cell visibibility per the changedRows
      const buf = this.props.bufferSize || 5;
      const visibles = visibleRows["s1"];
      var maxi = Math.max.apply(this, Object.keys(visibles));
      var mini = maxi;
      Object.keys(visibles).forEach((elem) => {
	  if (elem < mini && elem!= 1) {
	      mini = elem;
	  }
      });
      for (item in changedRows[1]) {
	  if (changedRows[1][item] == false) {
	      if (item > maxi)
		  continue;
	      changedRows[1][item-buf] = false;
	      changedRows[1][item] = true;
	  }
	  else {
	      if (item == mini) {
		  changedRows[1][item-buf] = true;
	      }
	  }
      }
    PrivateMethods.updateCellsVisibility(this.cellData, changedRows);

    // Premepty show rows to avoid onscreen flashes
//    PrivateMethods.updateCellsPremptively(this.props, this.cellData, visibleRows);

    // If the user supplied an onChangeVisibleRows function, then call it
    if (this.props.onChangeVisibleRows) {
      this.props.onChangeVisibleRows(visibleRows, changedRows);
    }
  }

  getNativeListView() {
    return this.refs.nativeListView;
  }

  // https://github.com/sghiassy/react-native-sglistview/issues/14
  getScrollResponder() {
    return this.refs.nativeListView.getScrollResponder();
  }

  /**
   * Render Methods
   */

  renderScrollComponent(props) {
    let component;

    if (props.renderScrollComponent) {
      component = props.renderScrollComponent(props);
    } else {
      component = (
        <ScrollView {...props} />
      );
    }

    return component;
  }

  renderRow(rowData, sectionID, rowID) {
    // Get the user's view
      const view = this.props.renderRow(rowData, sectionID, rowID);
      
    // Wrap the user's view in a SGListViewCell for tracking & performance
    return (
      <SGListViewCell
        usersView={view}
        ref={(row) => {
          // Capture a reference to the cell on creation
          // We have to do it this way for ListView: https://github.com/facebook/react-native/issues/897
          PrivateMethods.captureReferenceFor(this.cellData, sectionID, rowID, row);
        }} />
    );
  }

  render() {
    return (
      <ListView
        {...this.props}
        ref="nativeListView"
        renderScrollComponent={this.renderScrollComponent.bind(this)}
        renderRow={this.renderRow.bind(this)}
        onChangeVisibleRows={this.onChangeVisibleRows.bind(this)} />
    );
  }
};
