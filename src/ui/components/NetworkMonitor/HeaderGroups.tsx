import React, { useState } from "react";
import styles from "./RequestTable.module.css";
import classNames from "classnames";
import { Column, HeaderGroup } from "react-table";
import { RequestSummary } from "./utils";
import { ContextMenu } from "../ContextMenu";
import ColumnsDropdown from "./ColumnsDropdown";

interface MenuLocation {
  x: number;
  y: number;
}

export function HeaderGroups({
  columns,
  headerGroups,
}: {
  columns: Column[];
  headerGroups: HeaderGroup<RequestSummary>[];
}) {
  const [menuLocation, setMenuLocation] = useState<MenuLocation>();
  return (
    <div
      onContextMenu={ev => {
        ev.preventDefault();
        setMenuLocation({ x: ev.pageX, y: ev.pageY });
      }}
    >
      {menuLocation ? (
        <ContextMenu x={menuLocation.x} y={menuLocation.y} close={() => setMenuLocation(undefined)}>
          <ColumnsDropdown columns={columns} />
        </ContextMenu>
      ) : (
        ""
      )}
      {headerGroups.map((headerGroup: HeaderGroup<RequestSummary>) => {
        const { key, ...headerProps } = headerGroup.getHeaderGroupProps();
        return (
          <div
            key={key}
            className="flex items-center divide-x divide-themeTextField font-normal"
            {...headerProps}
          >
            {headerGroup.headers.map(column => {
              const { key, ...columnProps } = column.getHeaderProps();
              return (
                <div className={classNames("p-1", styles[column.id])} {...columnProps} key={key}>
                  {column.render("Header")}
                  <div
                    //@ts-ignore
                    {...column.getResizerProps()}
                    className={classNames("select-none", styles.resizer, {
                      //@ts-ignore typescript freaking *hates* react-table
                      isResizing: column.isResizing,
                    })}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
