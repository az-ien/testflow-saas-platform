import { parseJiraSite } from './JiraService';

describe('Jira site parsing', () => {
  it('accepts Jira Cloud URLs', () => {
    expect(parseJiraSite('https://acme.atlassian.net/browse/ENG-1')).toBe('https://acme.atlassian.net');
  });

  it('rejects non-Jira remotes', () => {
    expect(parseJiraSite('https://github.com/acme/app')).toBeNull();
  });
});
