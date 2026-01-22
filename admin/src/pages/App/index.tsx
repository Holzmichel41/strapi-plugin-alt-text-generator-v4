import React from 'react';
import { Switch, Route } from 'react-router-dom';
import { AnErrorOccurred } from '@strapi/helper-plugin';
import pluginId from '../../pluginId';
import BulkPage from '../BulkPage';
import SettingsPage from '../SettingsPage';

const App = () => {
  return (
    <div>
      <Switch>
        <Route path={`/plugins/${pluginId}`} component={BulkPage} exact />
        <Route path={`/settings/${pluginId}/settings`} component={SettingsPage} exact />
        <Route component={AnErrorOccurred} />
      </Switch>
    </div>
  );
};

export default App;
