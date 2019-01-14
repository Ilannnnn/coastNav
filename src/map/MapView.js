import React, { Component } from 'react';
import './MapView.css';
import _ from 'lodash';
import { Map, TileLayer } from 'react-leaflet';
import Control from 'react-leaflet-control';
import L from 'leaflet';
import 'leaflet-mouse-position';
import 'leaflet-rotatedmarker';

import StepService from '../services/StepService';
import Editor from '../side/editor/Editor';
import Drawkit from './drawkit/Drawkit';
import GuidelineStep from './steps/navStep/GuidelineStep';
import TBStep from './steps/navStep/TBStep';
import CogStep from './steps/navStep/CogStep';
import { StepType } from '../models/steps';
import CrntStep from './steps/navStep/CrntStep';
import TCStep from './steps/navStep/TCStep';

const stepService = new StepService();
const COOREDINATES_DEPTH = 7;
const center = [32.52018, 34.66461];

class MapView extends Component {

    leafletMap = null;
    leafletSteps = {};

    state = {
        steps: stepService.getSteps(),
        selectedStep: undefined,
        selectedTool: null,
        draw: {
            isDrawing: false,
        },
    }

    constructor(props) {
        super(props);
        this.escFunction = this.escFunction.bind(this);
    }

    componentDidMount() {
        document.addEventListener("keydown", this.escFunction, false);
        this.leafletMap.on('click', this.onMapClick.bind(this));
        this.setMousePosition();
        this.drawStateSteps();
    }
    componentWillUnmount() {
        document.removeEventListener("keydown", this.escFunction, false);
    }
    componentDidUpdate(prevProps, prevState) {        
        //this.leafletMap.invalidateSize();
        this.eraseSteps(prevState.steps);
        this.drawStateSteps();
    }

    render() {
        return (<section className="MapViewContainer">
            <Map id="map" key="mymap"
                ref={this.setLeafletMapRef}
                center={center} zoom={10}
                zoomControl={false}
                maxZoom={13}
                minZoom={7}
                onMouseMove={this.onDrawingMove.bind(this)}>

                <TileLayer
                    attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    opacity={0.5}
                />

                <TileLayer
                    attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                    url="israel/{z}/{x}/{y}.png"
                />

                <TileLayer
                    attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                    url="haifa/{z}/{x}/{y}.png"
                />

                <TileLayer
                    attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                    url="hadera/{z}/{x}/{y}.png"
                />

                <Control position="topright">
                    <Drawkit
                        selectedTool={this.state.selectedTool}
                        onSelectTool={this.onSelectTool.bind(this)}>
                    </Drawkit>
                </Control>

                <Control position="topleft">
                    <Editor step={this.state.selectedStep}
                        onStepChange={this.state.editorOnChange}
                        onSave={this.handleEditorSave.bind(this)}
                        onDelete={this.handleEditorDelete.bind(this)}
                    >
                    </Editor>
                </Control>

            </Map>
        </section>)
    }

    setLeafletMapRef = map => (this.leafletMap = map && map.leafletElement);

    /* Drawkit */
    onSelectTool(tool) {
        if (!this.state.selectedTool || this.state.selectedTool.type !== tool.type) {
            this.setState({ selectedTool: tool });
        }
        else {
            this.setState({ selectedTool: null });
        }
    }

    /* Mouse */
    setMousePosition() {
        if (!this.leafletMap) {
            console.error("Couldn't add lines to map. Missing map ref");
        }
        else {
            L.control.mousePosition({
                position: 'bottomright',
            }).addTo(this.leafletMap);
        }
    }

    /* Steps */
    drawStateSteps() {
        if (!this.state.steps) return;
        if (!this.leafletMap) {
            console.error("Couldn't add lines to map. Missing map ref");
            return;
        }
        this.drawSteps(this.state.steps);
    }

    eraseSteps(steps) {
        if (!steps) return;
        if (!this.leafletMap) {
            console.error("Couldn't add lines to map. Missing map ref");
            return;
        }
        steps.forEach(navStep => {
            // Remove all steps layers from map
            if (this.leafletSteps[navStep.id]) {
                this.leafletSteps[navStep.id].forEach(layer => {
                    this.leafletMap.removeLayer(layer);
                });
            }
        });
    }

    /**
     * Draw each nav step in state's steps list.
     * If step already exists, remove it, create a new one, and add it.
     */
    drawSteps(steps) {
        steps.forEach(navStep => {
            // Remove existing step's layers
            if (this.leafletSteps[navStep.id]) {
                this.leafletSteps[navStep.id].forEach(layer => {
                    this.leafletMap.removeLayer(layer);
                });
            }
            // Create new steps
            this.leafletSteps[navStep.id] = this._createNewStep(navStep);
            // Register event listeners
            this.leafletSteps[navStep.id].map(
                this.stepOnClickListener.bind(this)
            );
        });
    }

    _createNewStep(navStep) {
        switch (navStep.type) {
            case StepType.TB:
                return TBStep.addTo(this.leafletMap, navStep);
            case StepType.COG:
                return CogStep.addTo(this.leafletMap, navStep);
            case StepType.CRNT:
                return CrntStep.addTo(this.leafletMap, navStep);
            case StepType.TC:
                return TCStep.addTo(this.leafletMap, navStep);
            case StepType.GUIDELINE:
            default:
                return GuidelineStep.addTo(this.leafletMap, navStep);
        }
    }

    stepOnClickListener(stepLayer) {
        stepLayer.on('click', this.stepOnClick.bind(this));
    }

    stepOnClick(event) {
        if (this.state.draw.isDrawing) {
            return;
        }
        // Isolate click
        event.originalEvent.view.L.DomEvent.stopPropagation(event);

        // Find selected step
        let clickedStepId = +_.findKey(this.leafletSteps, (stepLayers) => {
            return stepLayers.indexOf(event.target) >= 0;
        });
        if (!clickedStepId) return;
        // Select / Unselect
        if (!this.state.selectedStep || clickedStepId !== this.state.selectedStep.id) {
            this.selectStep(_.find(this.state.steps, {
                id: clickedStepId
            }));
        }
        else {
            this.unSelectStep();
        }
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

    escFunction(event) {
        if (event.keyCode === 27) {
            this.handleEscPress();
        }
    }

    /**
     * Cancel drawing & unselect step when ESC pressed.
     */
    handleEscPress() {
        let steps;
        if (this.state.draw.isDrawing) {
            let selectedStep = this.state.selectedStep;
            steps = [...this.state.steps];
            _.remove(steps, step => step.id === selectedStep.id);
        }
        else {
            steps = this.state.steps;
        }
        this.setState({
            selectedStep: undefined,
            steps: steps,
            draw: {
                isDrawing: false,
            },
        });
    }

    onDrawingMove(event) {
        event.originalEvent.preventDefault();
        event.originalEvent.stopPropagation();
        if (this.state.draw.isDrawing) {
            // Update current selected step
            let updatedSteps = this.state.steps;
            let updatedSelectedStep = updatedSteps.find(step => {
                return step.id === this.state.selectedStep.id;
            });

            updatedSelectedStep = Object.assign(updatedSelectedStep, {
                positions: [
                    updatedSelectedStep.positions[0],
                    {
                        lat: Number((event.latlng.lat).toFixed(COOREDINATES_DEPTH)),
                        lng: Number((event.latlng.lng).toFixed(COOREDINATES_DEPTH))
                    }
                ]
            });

            this.setState({
                steps: updatedSteps,
                selectedStep: updatedSelectedStep,
            });
        }
    }

    onMapClick(event) {
        event.originalEvent.preventDefault();

        // If no tool selected - do nothing
        if (!this.state.selectedTool) {
            return;
        }
        if (!this.state.draw.isDrawing) {
            // Create a new step, stating at click position
            let newStep = stepService.createNewStep(
                Number((event.latlng.lat).toFixed(COOREDINATES_DEPTH)),
                Number((event.latlng.lng).toFixed(COOREDINATES_DEPTH)),
                this.state.selectedTool.type,
                this.state.steps
            );

            // assing the new line the current tool's options
            Object.assign(newStep, this.state.selectedTool.options);

            let updatedSteps = [...this.state.steps, newStep];

            // Mark the new step as the selected step      
            this.setState({
                draw: { isDrawing: true },
                steps: updatedSteps,
                selectedStep: newStep,
            });
        }
        else {
            this.setState({
                draw: { isDrawing: false },
            });
        }
    }

    handleRemoveStep(stepId) {
        // remove deleted step from steps list
        let updatedSteps = _.filter(this.state.steps, (step) => {
            return step.id !== stepId;
        });
        // unselect deleted step
        let selectedStep = this.state.selectedStep.id !== stepId
            ? this.state.selectedStep : null;

        this.setState({
            /* Update selected view */
            steps: updatedSteps,
            selectedStep: selectedStep,
        });
    }

    /* Editor */

    /**
     * Update the given step with given changes, taking
     * into consideration changes that effect other props.
     * Exp: angle -> end-position.
     * @param {number} updatedStepId 
     * @param {NavStepProps} changes 
     */
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

    handleEditorDelete(deletedStepId) {
        // Insert pop up alert here..
        this.handleRemoveStep(deletedStepId);
    }
}

export default MapView;