export interface Permission {
  read: boolean;
  create: boolean;
  delete: boolean;
  update: boolean;
}

export interface AccessControl {
  [resource: string]: Permission;
}
