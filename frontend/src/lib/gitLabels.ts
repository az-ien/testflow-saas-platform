export const gitLabel = (status?: string) => {
  if (status === 'awaiting_approval') return 'needs publish approval';
  if (status === 'pr_opened') return 'PR opened';
  if (status === 'unavailable') return 'dashboard only';
  if (status === 'rejected') return 'publish rejected';
  return status || 'no git';
};
