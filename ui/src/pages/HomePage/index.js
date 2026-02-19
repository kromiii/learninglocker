import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import Helmet from 'react-helmet';
import { connect } from 'react-redux';
import { Map, List as ImmutList, fromJS } from 'immutable';
import { compose, withProps, withState } from 'recompose';
import { actions as routerActions } from 'redux-router5';
import moment from 'moment';
import {
  isSiteAdminSelector,
  authenticationSelector,
  logout as logoutAction,
  orgLoginStart as orgLoginStartAction,
  loggedInUserSelector,
  orgLogout as orgLogoutAction
} from 'ui/redux/modules/auth';
import { queryStringToQuery } from 'ui/redux/modules/search';
import { withModel, withSchema } from 'ui/utils/hocs';
import FullPageBackground from 'ui/components/FullPageBackground';
import AuthContainer from 'ui/containers/AuthContainer';
import smallLogo from 'ui/static/smallLogo.png';
import OrgMemberButton from 'ui/containers/OrgMemberButton';
import { SITE_SETTINGS_ID } from 'lib/constants/siteSettings';

const Underline = styled.div`
  height: 0;
  border-bottom: 2px solid #dda476;
  width: 250px;
  margin: 0 auto;
`;

const Card = styled.div`
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  margin-top: 12px;
  padding: 20px;
`;

const OrgList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const OrgButton = styled.button`
  width: 100%;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding: 8px 12px;
`;

export const Home = ({
  models,
  logout,
  orgLogout,
  orgLoginStart,
  navigateTo,
  isSiteAdmin,
  auth,
  orgSearch,
  setOrgSearch,
  model,
  ok
}) => {
  const [proceedOnce, setProceedOnce] = useState(false);

  useEffect(() => {
    const hasProceeded = sessionStorage.getItem('proceedOnce') === 'true';
    setProceedOnce(hasProceeded);

    const sessionStorageSetHandler = () => {
      setProceedOnce(true);
    };

    document.addEventListener('setProceedOnce', sessionStorageSetHandler, false);
    orgLogout();

    return () => {
      document.removeEventListener('setProceedOnce', sessionStorageSetHandler, false);
    };
  }, [orgLogout]);

  const onClickOrgLogin = (orgId) => {
    const organisation = models.find(currentOrg => orgId === currentOrg.get('_id'));
    if (!organisation) return;

    if (
      !isSiteAdmin &&
      organisation.get('expiration') &&
      moment(organisation.get('expiration')).isBefore(moment())
    ) {
      return;
    }

    orgLoginStart({ organisation: orgId });
  };

  const onClickLogout = () => {
    logout();
  };

  const gotoSiteAdminUsers = () => {
    navigateTo('admin.users');
  };

  const gotoSiteAdminOrgs = () => {
    navigateTo('admin.organisations');
  };

  const renderOrgActions = organisation => (
    <div>
      {organisation.get('expiration') && moment(organisation.get('expiration')).isBefore(moment()) ? (
        <span style={{ color: 'red', marginRight: '8px' }}>Expired</span>
      ) : null}
      {isSiteAdmin ? (
        <OrgMemberButton
          schema="organisation"
          id={organisation.get('_id')} />
      ) : null}
    </div>
  );

  const renderOrgList = () => {
    if (models.isEmpty()) {
      return (
        <div style={{ marginTop: '5px', textAlign: 'center' }}>
          {orgSearch === ''
            ? 'You have not been added to any organisations.'
            : 'You do not belong to any organisations matching that search.'}
        </div>
      );
    }

    return (
      <OrgList>
        {models.map((organisation) => {
          const logoPath = organisation.get('logoPath') || smallLogo;
          return (
            <li key={organisation.get('_id')}>
              <OrgButton onClick={() => onClickOrgLogin(organisation.get('_id'))}>
                <span>
                  <img
                    alt="Organisation logo"
                    src={logoPath}
                    style={{ height: 24, marginRight: 8, width: 24 }} />
                  {organisation.get('name')}
                </span>
                {renderOrgActions(organisation)}
              </OrgButton>
            </li>
          );
        }).toArray()}
      </OrgList>
    );
  };

  const error = auth.get('error');
  const dontShowRegistration = (model.size === 0 || model.get('dontShowRegistration') || ok);
  const bypassRegistration = dontShowRegistration || proceedOnce;

  return (
    <FullPageBackground>
      <AuthContainer>
        <Helmet title=" - Choose an organisation" />
        <Underline />
        <h3>Choose your organisation</h3>
        {!bypassRegistration ? (
          <Card>
            <p>Welcome to the modernized UI experience.</p>
            <button
              className="btn btn-primary"
              onClick={() => {
                sessionStorage.setItem('proceedOnce', 'true');
                setProceedOnce(true);
              }}>
              Continue
            </button>
          </Card>
        ) : (
          <Card>
            {isSiteAdmin ? (
              <div>
                <h4>Site Administration</h4>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button className="btn btn-default" onClick={gotoSiteAdminUsers}>View all users</button>
                  <button className="btn btn-default" onClick={gotoSiteAdminOrgs}>View all organisations</button>
                </div>
              </div>
            ) : null}

            <h4>Your Organisations</h4>
            <input
              aria-label="Search organisations"
              className="form-control"
              onChange={event => setOrgSearch(event.target.value)}
              placeholder="Search organisations"
              style={{ marginBottom: 8 }}
              value={orgSearch} />
            {renderOrgList()}

            {error ? (
              <div className="alert alert-danger" role="alert" style={{ marginTop: 12 }}>
                <span className="sr-only">Error:</span> {error}
              </div>
            ) : null}
          </Card>
        )}

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button className="btn btn-danger" onClick={onClickLogout}>
            <i className="ion ion-log-out" /> Log Out
          </button>
        </div>
      </AuthContainer>
    </FullPageBackground>
  );
};

Home.propTypes = {
  models: PropTypes.instanceOf(ImmutList),
  logout: PropTypes.func,
  orgLogout: PropTypes.func,
  orgLoginStart: PropTypes.func,
  navigateTo: PropTypes.func,
  isSiteAdmin: PropTypes.bool,
  auth: PropTypes.instanceOf(Map),
  orgSearch: PropTypes.string,
  setOrgSearch: PropTypes.func,
  model: PropTypes.instanceOf(Map),
  ok: PropTypes.bool,
};

Home.defaultProps = {
  models: new ImmutList(),
  auth: new Map(),
  model: new Map(),
  isSiteAdmin: false,
  logout: () => {},
  orgLogout: () => {},
  orgLoginStart: () => {},
  navigateTo: () => {},
  orgSearch: '',
  setOrgSearch: () => {},
  ok: false,
};

export default compose(
  connect(state => ({
    auth: authenticationSelector(state),
    authUser: loggedInUserSelector(state),
    isSiteAdmin: isSiteAdminSelector(state)
  }), {
    logout: logoutAction,
    orgLoginStart: orgLoginStartAction,
    orgLogout: orgLogoutAction,
    navigateTo: routerActions.navigateTo
  }),
  withState('orgSearch', 'setOrgSearch', ''),
  withProps(({ authUser, orgSearch }) => {
    const userOrgs = authUser.get('organisations', new ImmutList());
    const searchFilter = queryStringToQuery(orgSearch, 'organisation');
    const userFilter = fromJS({ _id: { $in: userOrgs } });
    const filter = userFilter.merge(searchFilter);
    const sort = fromJS({ name: 1, _id: -1 });
    return { filter, sort };
  }),
  withSchema('organisation'),
  withProps(({ models }) => ({ models: models.toList() })),
  withProps(() => ({
    schema: 'siteSettings',
    id: SITE_SETTINGS_ID
  })),
  withModel,
  withState('ok', 'setOk', false),
)(Home);
