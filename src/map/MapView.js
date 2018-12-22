import React, { Component } from 'react';
import StepService from '../services/StepService';
import { Sidebar, Tab } from 'react-leaflet-sidebarv2';
import Editor from '../side/editor/Editor';
import NavStep from './steps/navStep/NavStep';

import { Map, TileLayer, FeatureGroup } from 'react-leaflet';
import L from 'leaflet';
import { EditControl } from 'react-leaflet-draw';

import _ from 'lodash';

import './MapView.css';

const stepService = new StepService();
const COOREDINATES_DEPTH = 7;
const center = [32.374, 35.116];

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.0.0/images/marker-icon.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.0.0/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.0.0/images/marker-shadow.png',
});

class MapView extends Component {

    _leafletMap = null;
    _editableFG = null

    state = {
        selectedStep: undefined,
        newStep: {
            isDrawing: false,
        },
        mouseInfo: {
            lan: undefined,
            lat: undefined,
        },
        collapsed: true,
        selected: 'home',
    }

    componentDidUpdate(prevProps, prevState) {
        this._leafletMap.invalidateSize();
        // Update collapse flag if selected step changed
        if (this.state.selectedStep !== prevState.selectedStep) {
            this.setState({
                collapsed: !this.state.selectedStep,
            });
        }
    }

    /* Draw functions */
    _onEdited = (e) => {

        let numEdited = 0;
        e.layers.eachLayer((layer) => {
            numEdited += 1;
        });
        console.log(`_onEdited: edited ${numEdited} layers`, e);

        this._onChange();
    }

    _onCreated = (e) => {
        let type = e.layerType;
        let layer = e.layer;
        if (type === 'marker') {
            // Do marker specific actions
            console.log("_onCreated: marker created", e);
        }
        else {
            console.log("_onCreated: something else created:", type, e);
        }
        // Do whatever else you need to. (save to db; etc)
        debugger;
        // handleNewStep()
        this._onChange();
    }

    _onDeleted = (e) => {

        let numDeleted = 0;
        e.layers.eachLayer((layer) => {
            numDeleted += 1;
        });
        console.log(`onDeleted: removed ${numDeleted} layers`, e);

        this._onChange();
    }

    _onMounted = (drawControl) => {
        console.log('_onMounted', drawControl);
    }

    _onEditStart = (e) => {
        console.log('_onEditStart', e);
    }

    _onEditStop = (e) => {
        console.log('_onEditStop', e);
    }

    _onDeleteStart = (e) => {
        console.log('_onDeleteStart', e);
    }

    _onDeleteStop = (e) => {
        console.log('_onDeleteStop', e);
    }

    render() {
        return (<section className="MapViewContainer">
            <Map id="map" key="mymap"
                ref={this.setLeafletMapRef}
                center={center} zoom={10}>

                <FeatureGroup ref={(reactFGref) => { this._onFeatureGroupReady(reactFGref); }}>
                    <EditControl
                        position='topright'
                        onEdited={this._onEdited}
                        onCreated={this._onCreated}
                        onDeleted={this._onDeleted}
                        onMounted={this._onMounted}
                        onEditStart={this._onEditStart}
                        onEditStop={this._onEditStop}
                        onDeleteStart={this._onDeleteStart}
                        onDeleteStop={this._onDeleteStop}
                        draw={{
                            polygon: false,
                            rectangle: false,
                            polyline: {
                                shapeOptions: {
                                    color: 'black'
                                }
                            }
                        }}
                    />
                </FeatureGroup>

                <Sidebar id="sidebar"
                    collapsed={this.state.collapsed}
                    selected={this.state.selected}
                    onOpen={this.onSideBarOpen.bind(this)}
                    onClose={this.onSideBarClose.bind(this)}
                    onClick={this.onSideBarClick.bind(this)}>
                    <Tab id="home" header="Home" icon="fa fa-home">
                        <Editor step={this.state.selectedStep}
                            onStepChange={this.state.editorOnChange}
                            onSave={this.state.editorOnSave}></Editor>
                    </Tab>
                    <Tab id="settings" header="Settings" icon="fa fa-cog" anchor="bottom">
                        <p>Settings dialogue.</p>
                    </Tab>
                </Sidebar>

                <TileLayer
                    attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {this.getNavSteps()}
            </Map>
        </section>)
    }

    _onFeatureGroupReady = (reactFGref) => {
        
        if (reactFGref) {
            debugger;
            // store the ref for future access to content
            this._editableFG = reactFGref;
        }
    }

    _onChange = () => {

        // this._editableFG contains the edited geometry, which can be manipulated through the leaflet API

        const { onChange } = this.props;

        if (!this._editableFG || !onChange) {
            return;
        }

        const geojsonData = this._editableFG.leafletElement.toGeoJSON();
        onChange(geojsonData);
    }

    setLeafletMapRef = map => (this._leafletMap = map && map.leafletElement);

    /* Sidebar */
    onSideBarClose() {
        this.setState({ collapsed: true });
    }

    onSideBarOpen(id) {
        this.setState({
            collapsed: false,
            selected: id,
        });
    }

    onSideBarClick(event) {
        event.originalEvent.preventDefault();
        event.originalEvent.view.L.DomEvent.stopPropagation(event);
    }

    /* Steps */
    getNavSteps() {
        let steps = [];
        if (this.state.steps) {
            this.state.steps.forEach(navStep => {
                steps.push(<NavStep {...navStep} key={navStep.id}
                    handleClick={this.handleStepClick.bind(this)}></NavStep>);
            });
        }
        return steps;
    }

    selectStep(step) {
        this.setState({
            selectedStep: step,
        });
    }

    unSelectStep() {
        this.setState({
            selectedStep: undefined,
        });
    }

    handleStepClick(stepId) {
        this.selectStep(this.state.steps.find(
            (step) => {
                return step.id === stepId;
            })
        );
    }

    handleEditorSave(updatedStepId, changes) {
        let steps = this.state.steps;
        let oldStep = steps.find((step) => {
            return step.id === updatedStepId;
        });
        if (oldStep) {
            Object.assign(oldStep, changes);
        }

        /* Update selected view & global steps list */
        this.setState({
            selectedStep: this.state.steps.find((step) => {
                return step.id === updatedStepId;
            }),
            steps: steps,
        });
    }
}

export default MapView;
