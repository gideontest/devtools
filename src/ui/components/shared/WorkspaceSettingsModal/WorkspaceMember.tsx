import classnames from "classnames";
import React, { useState, useEffect } from "react";
import hooks from "ui/hooks";
import { WorkspaceUser, WorkspaceUserRole } from "ui/types";
import PortalDropdown from "ui/components/shared/PortalDropdown";
import { connect, ConnectedProps } from "react-redux";
import * as actions from "ui/actions/app";
import MaterialIcon from "../MaterialIcon";
import { AvatarImage } from "ui/components/Avatar";
import { useConfirm } from "../Confirm";
import { Dropdown, DropdownDivider, DropdownItem } from "ui/components/Library/LibraryDropdown";

type WorkspaceMemberProps = {
  member: WorkspaceUser;
  isAdmin: boolean;
  canLeave?: boolean;
} & PropsFromRedux;

const memberRoleLabels: Record<WorkspaceUserRole, string> = {
  admin: "Admin",
  debugger: "Developer",
  viewer: "User",
};

function getMemberRole(member: WorkspaceUser) {
  return (
    (member.roles?.includes("admin") && "admin") ||
    (member.roles?.includes("debugger") && "debugger") ||
    "viewer"
  );
}

function WorkspaceMemberRoleOption({
  value,
  selected,
  onSelect,
}: {
  value: WorkspaceUserRole;
  selected: WorkspaceUserRole;
  onSelect: (value: WorkspaceUserRole) => void;
}) {
  const isSelected = selected === value;
  return (
    <label
      className={classnames("permissions-dropdown-item block", {
        "font-bold": isSelected,
      })}
    >
      <input
        type="radio"
        name="workspaceUserRole"
        className="h-0 w-0 opacity-0"
        value={value}
        checked={isSelected}
        onChange={e => e.target.checked && onSelect(value)}
      />
      <span>{memberRoleLabels[value]}</span>
    </label>
  );
}

function WorkspaceMemberRoles({
  isAdmin,
  member,
  onClick,
}: {
  isAdmin: boolean;
  member: WorkspaceUser;
  onClick: () => void;
}) {
  const role: WorkspaceUserRole = getMemberRole(member);
  const { updateWorkspaceMemberRole } = hooks.useUpdateWorkspaceMemberRole();
  const [selectedRole, setSelectedRole] = useState<WorkspaceUserRole>(role);

  useEffect(() => setSelectedRole(role), [role]);

  const selectRole = (updated: WorkspaceUserRole) => {
    onClick();
    const roles: WorkspaceUserRole[] = ["viewer"];
    if (updated === "admin") {
      roles.push("debugger");
      roles.push("admin");
    } else if (updated === "debugger") {
      roles.push("debugger");
    }

    setSelectedRole(updated);
    updateWorkspaceMemberRole({
      variables: {
        id: member.membershipId,
        roles,
      },
    }).catch(e => {
      console.error(e);
      setSelectedRole(selectedRole);
    });
  };

  return (
    <div>
      <WorkspaceMemberRoleOption value="viewer" onSelect={selectRole} selected={selectedRole} />
      <WorkspaceMemberRoleOption value="debugger" onSelect={selectRole} selected={selectedRole} />
      {isAdmin ? (
        <WorkspaceMemberRoleOption value="admin" onSelect={selectRole} selected={selectedRole} />
      ) : null}
    </div>
  );
}

function Status({
  member,
  hideArrow = false,
  title,
}: {
  member: WorkspaceUser;
  hideArrow?: boolean;
  title?: string;
}) {
  return (
    <div
      className={classnames("group flex flex-row items-center", { italic: member.pending })}
      title={title}
    >
      <span className="whitespace-pre">
        {memberRoleLabels[getMemberRole(member)]}
        {member.pending ? " (pending)" : ""}
      </span>
      <MaterialIcon
        className={classnames("material-icons opacity-0", {
          "group-hover:opacity-100": !hideArrow,
        })}
        iconSize="xl"
      >
        expand_more
      </MaterialIcon>
    </div>
  );
}

export function NonRegisteredWorkspaceMember({
  member,
  isAdmin,
}: {
  member: WorkspaceUser;
  isAdmin: boolean;
}) {
  const deleteUserFromWorkspace = hooks.useDeleteUserFromWorkspace();
  const [expanded, setExpanded] = useState(false);
  const { confirmDestructive } = useConfirm();

  const handleDelete = () => {
    setExpanded(false);
    confirmDestructive({
      message: "Remove team member?",
      description: `Are you sure you want to remove ${member.email} from this team?`,
      acceptLabel: "Remove them",
    }).then(confirmed => {
      if (confirmed) {
        deleteUserFromWorkspace({ variables: { membershipId: member.membershipId } });
      }
    });
  };

  return (
    <li className="flex flex-row items-center space-x-1.5">
      <div className="grid items-center justify-center" style={{ width: "28px", height: "28px" }}>
        <MaterialIcon iconSize="xl">mail_outline</MaterialIcon>
      </div>
      <div className="flex-grow overflow-hidden overflow-ellipsis whitespace-pre">
        {member.email}
      </div>
      <PortalDropdown
        buttonContent={<Status member={member} />}
        setExpanded={setExpanded}
        expanded={expanded}
        buttonStyle=""
        position="bottom-right"
      >
        <Dropdown>
          <WorkspaceMemberRoles
            member={member}
            isAdmin={isAdmin}
            onClick={() => setExpanded(false)}
          />
          <DropdownDivider />
          <DropdownItem onClick={handleDelete}>Remove</DropdownItem>
        </Dropdown>
      </PortalDropdown>
    </li>
  );
}

function Role({
  canLeave,
  member,
  setWorkspaceId,
  hideModal,
  isAdmin,
}: {
  member: WorkspaceUser;
  setWorkspaceId: any;
  hideModal: any;
  isAdmin: boolean;
  canLeave: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const deleteUserFromWorkspace = hooks.useDeleteUserFromWorkspace();
  const updateDefaultWorkspace = hooks.useUpdateDefaultWorkspace();
  const { userId: localUserId } = hooks.useGetUserId();
  const { userId, membershipId } = member;

  const handleDelete = () => {
    setExpanded(false);

    const leaveMsg = `Are you sure you want to leave this team?`;
    const kickMsg = `Are you sure you want to remove ${member.user!.name} from this team?`;
    const isPersonal = localUserId == userId;
    const message = isPersonal ? leaveMsg : kickMsg;

    if (window.confirm(message)) {
      deleteUserFromWorkspace({ variables: { membershipId } });

      // If the user is the member leaving, hide the modal and go back
      // to the personal workspace.
      if (isPersonal) {
        hideModal();
        setWorkspaceId(null);
        updateDefaultWorkspace({ variables: { workspaceId: null } });
      }
    }
  };

  if (!canLeave) {
    return (
      <Status
        member={member}
        hideArrow
        title="Promote another team member to admin in order to leave this team"
      />
    );
  }

  return (
    <PortalDropdown
      buttonContent={<Status member={member} />}
      setExpanded={setExpanded}
      expanded={expanded}
      buttonStyle=""
      position="bottom-right"
    >
      <Dropdown>
        {localUserId !== userId ? (
          <>
            <WorkspaceMemberRoles
              member={member}
              isAdmin={isAdmin}
              onClick={() => setExpanded(false)}
            />
            <DropdownDivider />
          </>
        ) : null}
        <DropdownItem onClick={handleDelete}>
          {member.pending ? "Cancel" : localUserId == userId ? "Leave" : "Remove"}
        </DropdownItem>
      </Dropdown>
    </PortalDropdown>
  );
}

function WorkspaceMember({
  member,
  setWorkspaceId,
  hideModal,
  isAdmin,
  canLeave = false,
}: WorkspaceMemberProps) {
  return (
    <li className="flex flex-row items-center space-x-1.5">
      <AvatarImage
        src={member.user!.picture}
        className="avatar rounded-full"
        style={{ width: "28px", height: "28px" }}
      />
      <div className="flex-grow overflow-hidden overflow-ellipsis whitespace-pre" data-private>
        {member.user!.name}
      </div>
      <Role
        member={member}
        setWorkspaceId={setWorkspaceId}
        hideModal={hideModal}
        isAdmin={isAdmin}
        canLeave={canLeave}
      />
    </li>
  );
}

const connector = connect(() => ({}), {
  setWorkspaceId: actions.setWorkspaceId,
  hideModal: actions.hideModal,
});
export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(WorkspaceMember);
