import React from 'react';
import renderer from 'react-test-renderer';
import { fromJS } from 'immutable';
import { Home } from './index';

jest.mock('ui/components/FullPageBackground', () => ({ children }) => <div>{children}</div>);
jest.mock('ui/containers/AuthContainer', () => ({ children }) => <div>{children}</div>);
jest.mock('ui/containers/OrgMemberButton', () => () => <div />);
jest.mock('ui/static/smallLogo.png', () => 'small-logo');

describe('HomePage', () => {
  const createProps = overrides => ({
    models: fromJS([]),
    logout: jest.fn(),
    orgLogout: jest.fn(),
    orgLoginStart: jest.fn(),
    navigateTo: jest.fn(),
    isSiteAdmin: false,
    auth: fromJS({}),
    orgSearch: '',
    setOrgSearch: jest.fn(),
    model: fromJS({}),
    ok: false,
    ...overrides,
  });

  beforeEach(() => {
    global.sessionStorage = {
      getItem: () => 'false',
      setItem: jest.fn(),
    };
    global.document = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
  });

  it('renders modernized registration gate content', () => {
    const component = renderer.create(
      <Home {...createProps({ model: fromJS({ dontShowRegistration: false, name: 'site' }) })} />
    ).toJSON();

    expect(JSON.stringify(component)).toContain('modernized UI experience');
  });

  it('renders organisations when registration is bypassed', () => {
    const models = fromJS([{ _id: 'org-1', name: 'Org One' }]);
    const model = fromJS({ dontShowRegistration: true });

    const component = renderer.create(
      <Home {...createProps({ models, model })} />
    ).toJSON();

    expect(JSON.stringify(component)).toContain('Org One');
  });
});
