import { connect } from 'react-redux';
import { push } from 'react-router-redux';
import { bindActionCreators } from 'redux';
import LoggedIn from '../components/LoggedIn';
import allActions from '../actions';

const mapStateToProps = (state) => {
    return state;
};

const mapDispatchToProps = (dispatch) => { // eslint-disable-line no-unused-vars
    const actions = bindActionCreators(allActions, dispatch);
    return {

        onLogout: (data) => {
            actions.logout(data);
            dispatch(push('/'));
        },

        onDeviceUpdate: (data) => {
            console.log('onDeviceUpdate', data);
            actions.deviceUpdate(data);
        },

        onUpdateConfiguration: (pluginName, configuration) => {
            actions.configurationUpdate({
                [pluginName]: configuration
            });
        },

        onSetPluginEnabled: ( pluginName, isChecked ) => {
            console.log(pluginName, isChecked);
            actions.setPluginEnabled({
                pluginName: pluginName,
                isChecked: isChecked
            });
        },

        onPluginInstalled: (data) => {
            actions.installedPluginUpdate(data);
        },

        onPluginRemoved: (data) => {
            actions.installedPluginRemove(data);
        }

    };
};

export default connect(mapStateToProps, mapDispatchToProps)(LoggedIn);
