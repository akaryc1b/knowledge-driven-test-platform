import { ProjectAccessError } from '@kdtp/project-membership';

export function mapProjectAccessPostgresError(error, operation) {
  if (error instanceof ProjectAccessError) return error;
  if (error?.code === '23505') {
    if (String(error.constraint).includes('projects_pkey')) {
      return new ProjectAccessError('PROJECT_EXISTS', 'Project already exists', { operation });
    }
    if (String(error.constraint).includes('project_memberships_pkey')) {
      return new ProjectAccessError('MEMBERSHIP_EXISTS', 'Project membership already exists', { operation });
    }
  }
  if (error?.code === '23503') {
    return new ProjectAccessError('PROJECT_NOT_FOUND', 'Project does not exist for membership', { operation });
  }
  if (error?.code === '23514') {
    return new ProjectAccessError('PROJECT_ACCESS_STORAGE_CONSTRAINT', 'Project access storage constraint rejected the write', {
      operation,
      constraint: error.constraint,
    });
  }
  return new ProjectAccessError('PROJECT_ACCESS_STORAGE_ERROR', 'Project access storage operation failed', {
    operation,
    postgresCode: error?.code,
  });
}
