/**
 * AV Audit - Google Blockly Visual Logic Automation Service
 * Provides industrial-grade visual block programming for Dashboard widget automations.
 */

const dashboardBlocklyService = {
  workspace: null,
  isInitialized: false,
  activeWidgetProperties: ['label', 'subtitle', 'icon', 'color', 'state', 'value'],

  // 1. Define Modern Custom Renderer & Dark Minimalist Theme for Blockly
  registerCustomRenderer() {
    if (typeof Blockly === 'undefined' || !Blockly.blockRendering) return;
    if (Blockly.registry && Blockly.registry.hasItem(Blockly.registry.Type.RENDERER, 'modern_dark')) return;

    const BaseRenderer = Blockly.zelos ? Blockly.zelos.Renderer : Blockly.blockRendering.Renderer;
    const BaseConstantProvider = Blockly.zelos ? Blockly.zelos.ConstantProvider : Blockly.blockRendering.ConstantProvider;

    class ModernConstantProvider extends BaseConstantProvider {
      constructor() {
        super();
        this.GRID_UNIT = 4;
        
        // Thicker, spacious blocks with modern rounded corners
        this.CORNER_RADIUS = 8;
        this.NOTCH_WIDTH = 22;
        this.NOTCH_HEIGHT = 6;
        this.NOTCH_OFFSET_LEFT = 18;

        // Spacious Statement Padding & Indents
        this.STATEMENT_INPUT_PADDING_LEFT = 24;
        this.STATEMENT_BOTTOM_SPACER = 8;
        this.BETWEEN_STATEMENT_PADDING_Y = 8;

        // Modern Input & Text Field Geometry
        this.FIELD_TEXT_FONTSIZE = 12;
        this.FIELD_TEXT_FONTWEIGHT = '600';
        this.FIELD_TEXT_FONTFAMILY = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
        this.FIELD_TEXT_HEIGHT = 24;
        this.FIELD_BORDER_RECT_RADIUS = 6;
        this.FIELD_BORDER_RECT_HEIGHT = 30;
        this.FIELD_BORDER_RECT_X_PADDING = 10;
        this.FIELD_BORDER_RECT_Y_PADDING = 4;
        this.FIELD_DROPDOWN_BORDER_RECT_HEIGHT = 30;

        // Enhanced Block Thickness / Heights
        this.DUMMY_INPUT_MIN_HEIGHT = 40;
        this.MIN_BLOCK_HEIGHT = 42;
        this.TOP_ROW_MIN_HEIGHT = 6;
        this.BOTTOM_ROW_MIN_HEIGHT = 6;
        this.EMPTY_STATEMENT_INPUT_HEIGHT = 36;
        this.EMPTY_INLINE_INPUT_HEIGHT = 32;

        // Start Hat for Root Triggers
        this.START_HAT_HEIGHT = 16;
        this.START_HAT_WIDTH = 90;
      }

      /**
       * CSS generated directly by renderer for ultra-clean minimalist rendering
       */
      getCSS_(selector) {
        const base = super.getCSS_(selector) || [];
        return [
          ...base,
          `${selector} .blocklyPath { stroke-width: 1.5px !important; stroke-linejoin: round !important; }`,
          `${selector} .blocklySelected > .blocklyPath { stroke: #38bdf8 !important; stroke-width: 2.5px !important; filter: drop-shadow(0 0 10px rgba(56, 189, 248, 0.55)); }`,
          `${selector} .blocklyFieldRect { fill: rgba(0, 0, 0, 0.35) !important; stroke: rgba(255, 255, 255, 0.12) !important; stroke-width: 1px !important; rx: 6px !important; ry: 6px !important; }`,
          `${selector} .blocklyEditableText:hover > .blocklyFieldRect { fill: rgba(0, 0, 0, 0.55) !important; stroke: rgba(255, 255, 255, 0.3) !important; }`,
          `${selector} .blocklyDropdownText, ${selector} .blocklyText { fill: #f8fafc !important; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important; font-weight: 600 !important; font-size: 11.5px !important; }`,
          `${selector} .blocklyNonEditableText > .blocklyText { fill: #e2e8f0 !important; font-weight: 700 !important; }`
        ];
      }
    }

    class ModernRenderer extends BaseRenderer {
      constructor(name) {
        super(name);
      }
      makeConstants_() {
        return new ModernConstantProvider();
      }
    }

    Blockly.blockRendering.register('modern_dark', ModernRenderer);
  },

  defineTheme() {
    if (typeof Blockly === 'undefined') return;

    this.registerCustomRenderer();

    if (Blockly.Themes && Blockly.Themes.HaDarkTheme) {
      return Blockly.Themes.HaDarkTheme;
    }

    const theme = Blockly.Theme.defineTheme('haDarkTheme', {
      base: Blockly.Themes.Classic,
      blockStyles: {
        trigger_blocks: {
          colourPrimary: '#0c324e',
          colourSecondary: '#071f32',
          colourTertiary: '#38bdf8',
          hat: 'cap'
        },
        logic_blocks: {
          colourPrimary: '#341a54',
          colourSecondary: '#200f35',
          colourTertiary: '#c084fc'
        },
        loop_blocks: {
          colourPrimary: '#4a2505',
          colourSecondary: '#2f1602',
          colourTertiary: '#fbbf24'
        },
        action_blocks: {
          colourPrimary: '#0b3d2f',
          colourSecondary: '#06261d',
          colourTertiary: '#34d399'
        },
        network_blocks: {
          colourPrimary: '#163359',
          colourSecondary: '#0d2038',
          colourTertiary: '#60a5fa'
        },
        notify_blocks: {
          colourPrimary: '#4a1233',
          colourSecondary: '#2e0a1f',
          colourTertiary: '#f472b6'
        },
        time_blocks: {
          colourPrimary: '#222d3b',
          colourSecondary: '#151d27',
          colourTertiary: '#94a3b8'
        }
      },
      categoryStyles: {
        triggers_category: { colour: '#38bdf8' },
        logic_category: { colour: '#c084fc' },
        loops_category: { colour: '#fbbf24' },
        properties_category: { colour: '#34d399' },
        network_category: { colour: '#60a5fa' },
        notify_category: { colour: '#f472b6' },
        time_category: { colour: '#94a3b8' }
      },
      componentStyles: {
        workspaceBackgroundColour: '#0b0f17',
        toolboxBackgroundColour: '#111622',
        toolboxForegroundColour: '#e2e8f0',
        flyoutBackgroundColour: '#141b29',
        flyoutForegroundColour: '#f1f5f9',
        flyoutOpacity: 0.98,
        scrollbarColour: '#243044',
        scrollbarOpacity: 0.65,
        insertionMarkerColour: '#38bdf8',
        insertionMarkerOpacity: 0.85,
        markerColour: '#38bdf8',
        cursorColour: '#38bdf8'
      },
      fontStyle: {
        family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        weight: '600',
        size: 11.5
      }
    });

    return theme;
  },

  // 2. Register Custom Block Types
  registerBlocks(availableProperties = []) {
    if (typeof Blockly === 'undefined') return;

    this.activeWidgetProperties = (availableProperties && availableProperties.length > 0)
      ? availableProperties
      : ['label', 'subtitle', 'icon', 'color', 'state', 'value', 'enabled', 'alert_on'];

    const propOptions = this.activeWidgetProperties.map(p => [p, p]);

    // 1. ROOT AUTOMATION RULE BLOCK
    Blockly.Blocks['ha_automation_rule'] = {
      init: function () {
        this.appendDummyInput()
          .appendField('⚡ AUTOMATION:')
          .appendField(new Blockly.FieldTextInput('Automation Rule'), 'RULE_NAME');

        this.appendDummyInput()
          .appendField('Trigger When:')
          .appendField(new Blockly.FieldDropdown([
            ['onTap (User Click / Press)', 'onTap'],
            ['onToggleOn (When Turned ON)', 'onToggleOn'],
            ['onToggleOff (When Turned OFF)', 'onToggleOff'],
            ['onChange (On Value Change)', 'onChange'],
            ['onInfo (/info Subscription POST)', 'onInfo'],
            ['onPolling (HTTP Polling GET)', 'onPolling']
          ]), 'TRIGGER_TYPE');

        this.appendDummyInput('INFO_ROW')
          .appendField('Subscribed /info Key:')
          .appendField(new Blockly.FieldTextInput('tablets/stage_left'), 'INFO_KEY');

        this.appendDummyInput('POLL_ROW')
          .appendField('Poll URL:')
          .appendField(new Blockly.FieldTextInput('https://api.example.com/status'), 'POLL_URL')
          .appendField('Interval (sec):')
          .appendField(new Blockly.FieldNumber(1.0, 0.1, 3600, 0.1), 'POLL_INTERVAL');

        this.appendStatementInput('ACTIONS')
          .setCheck(null)
          .appendField('▶ Actions:');

        this.setStyle('trigger_blocks');
        this.setTooltip('Root rule triggered by card tap, toggle, /info feed, or polling.');
        this.setHelpUrl('');

        // Dynamic update of trigger-specific inputs
        this.setOnChange((changeEvent) => {
          if (!this.workspace || this.workspace.isDragging()) return;
          const trigType = this.getFieldValue('TRIGGER_TYPE');
          const infoRow = this.getInput('INFO_ROW');
          const pollRow = this.getInput('POLL_ROW');

          if (infoRow) infoRow.setVisible(trigType === 'onInfo');
          if (pollRow) pollRow.setVisible(trigType === 'onPolling');
        });
      }
    };

    // 2. IF / ELSE FLOW BLOCK
    Blockly.Blocks['ha_if_else'] = {
      init: function () {
        this.appendDummyInput()
          .appendField('🔀 IF')
          .appendField(new Blockly.FieldTextInput('data.battery < 20'), 'CONDITION');

        this.appendStatementInput('DO_THEN')
          .setCheck(null)
          .appendField('THEN');

        this.appendStatementInput('DO_ELSE')
          .setCheck(null)
          .appendField('ELSE');

        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setStyle('logic_blocks');
        this.setTooltip('Conditional branch. Executes THEN if condition is true, ELSE otherwise.');
      }
    };

    // 3. REPEAT LOOP BLOCK
    Blockly.Blocks['ha_repeat'] = {
      init: function () {
        this.appendDummyInput()
          .appendField('🔁 REPEAT')
          .appendField(new Blockly.FieldNumber(2, 1, 50, 1), 'COUNT')
          .appendField('TIMES');

        this.appendStatementInput('DO')
          .setCheck(null)
          .appendField('DO');

        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setStyle('loop_blocks');
        this.setTooltip('Repeats child actions a specified number of times.');
      }
    };

    // 4. SET PROPERTY BLOCK
    Blockly.Blocks['ha_set_property'] = {
      init: function () {
        this.appendDummyInput()
          .appendField('🏷️ SET')
          .appendField(new Blockly.FieldDropdown(propOptions), 'PROPERTY')
          .appendField('=')
          .appendField(new Blockly.FieldTextInput('""'), 'VALUE');

        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setStyle('action_blocks');
        this.setTooltip('Updates a property on this widget card (e.g. label, color, subtitle, state, value).');
      }
    };

    // 5. WEBHOOK BLOCK
    Blockly.Blocks['ha_webhook'] = {
      init: function () {
        this.appendDummyInput()
          .appendField('🌐 WEBHOOK')
          .appendField(new Blockly.FieldDropdown([
            ['POST', 'POST'],
            ['GET', 'GET'],
            ['PUT', 'PUT'],
            ['DELETE', 'DELETE'],
            ['PATCH', 'PATCH']
          ]), 'METHOD')
          .appendField('URL:')
          .appendField(new Blockly.FieldTextInput('https://api.example.com/action'), 'URL');

        this.appendDummyInput()
          .appendField('Payload Body:')
          .appendField(new Blockly.FieldTextInput('{"state": "${widget.state}"}'), 'BODY');

        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setStyle('network_blocks');
        this.setTooltip('Sends an HTTP webhook request with optional templated payload.');
      }
    };

    // 6. DELAY BLOCK
    Blockly.Blocks['ha_delay'] = {
      init: function () {
        this.appendDummyInput()
          .appendField('⏱️ WAIT')
          .appendField(new Blockly.FieldNumber(0.5, 0.05, 300, 0.1), 'SECONDS')
          .appendField('SECONDS');

        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setStyle('time_blocks');
        this.setTooltip('Pauses execution before running subsequent actions.');
      }
    };

    // 7. TOAST NOTIFICATION BLOCK
    Blockly.Blocks['ha_toast'] = {
      init: function () {
        this.appendDummyInput()
          .appendField('💬 TOAST')
          .appendField(new Blockly.FieldTextInput('Action executed successfully!'), 'MESSAGE');

        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setStyle('notify_blocks');
        this.setTooltip('Displays a popup toast notification to the user.');
      }
    };

    // 8. CONFIRMATION PROMPT BLOCK
    Blockly.Blocks['ha_confirm'] = {
      init: function () {
        this.appendDummyInput()
          .appendField('⚠️ CONFIRM')
          .appendField(new Blockly.FieldTextInput('Are you sure you want to proceed?'), 'MESSAGE');

        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setStyle('notify_blocks');
        this.setTooltip('Prompts the user with a confirmation dialog. Stops execution if cancelled.');
      }
    };

    this.isInitialized = true;
  },

  // 3. Build Toolbox XML Definition
  getToolboxDef() {
    return {
      kind: 'categoryToolbox',
      contents: [
        {
          kind: 'category',
          name: '⚡ Rules & Triggers',
          categorystyle: 'triggers_category',
          contents: [
            { kind: 'block', type: 'ha_automation_rule' }
          ]
        },
        {
          kind: 'category',
          name: '🔀 Logic & If/Else',
          categorystyle: 'logic_category',
          contents: [
            { kind: 'block', type: 'ha_if_else' }
          ]
        },
        {
          kind: 'category',
          name: '🔁 Loops (Repeat)',
          categorystyle: 'loops_category',
          contents: [
            { kind: 'block', type: 'ha_repeat' }
          ]
        },
        {
          kind: 'category',
          name: '🏷️ Set Properties',
          categorystyle: 'properties_category',
          contents: [
            { kind: 'block', type: 'ha_set_property' }
          ]
        },
        {
          kind: 'category',
          name: '🌐 Webhooks & API',
          categorystyle: 'network_category',
          contents: [
            { kind: 'block', type: 'ha_webhook' }
          ]
        },
        {
          kind: 'category',
          name: '⏱️ Delay & Timing',
          categorystyle: 'time_category',
          contents: [
            { kind: 'block', type: 'ha_delay' }
          ]
        },
        {
          kind: 'category',
          name: '💬 Toasts & Alerts',
          categorystyle: 'notify_category',
          contents: [
            { kind: 'block', type: 'ha_toast' },
            { kind: 'block', type: 'ha_confirm' }
          ]
        }
      ]
    };
  },

  // 4. Inject Workspace into DOM Container
  injectWorkspace(containerEl, automations = [], availableProperties = []) {
    if (typeof Blockly === 'undefined' || !containerEl) return null;

    this.defineTheme();
    this.registerBlocks(availableProperties);

    if (this.workspace) {
      try { this.workspace.dispose(); } catch (e) { }
      this.workspace = null;
    }

    containerEl.innerHTML = '';

    const theme = Blockly.Themes.HaDarkTheme || 'haDarkTheme';
    const toolbox = this.getToolboxDef();

    this.workspace = Blockly.inject(containerEl, {
      theme: theme,
      toolbox: toolbox,
      grid: {
        spacing: 20,
        length: 2,
        colour: 'rgba(255, 255, 255, 0.05)',
        snap: true
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.95,
        maxScale: 2,
        minScale: 0.4,
        scaleSpeed: 1.15,
        pinch: true
      },
      trashcan: true,
      scrollbars: true,
      sounds: false,
      renderer: 'modern_dark',
      media: '/js/libs/blockly/media/'
    });

    // Populate with existing rules
    this.importJsonToWorkspace(automations);

    // Re-layout and trigger resize on flyout
    setTimeout(() => {
      if (this.workspace) {
        Blockly.svgResize(this.workspace);
      }
    }, 50);

    return this.workspace;
  },

  // 5. Import Rules from JSON Model to Visual Blocks
  importJsonToWorkspace(automations = []) {
    if (!this.workspace) return;
    this.workspace.clear();

    if (!Array.isArray(automations) || automations.length === 0) {
      // Create a default initial rule block
      const defaultRuleBlock = this.workspace.newBlock('ha_automation_rule');
      defaultRuleBlock.setFieldValue('On Tap Action', 'RULE_NAME');
      defaultRuleBlock.setFieldValue('onTap', 'TRIGGER_TYPE');
      defaultRuleBlock.initSvg();
      defaultRuleBlock.render();
      defaultRuleBlock.moveBy(40, 40);
      return;
    }

    let currentY = 40;

    automations.forEach((macro, idx) => {
      const ruleBlock = this.workspace.newBlock('ha_automation_rule');
      ruleBlock.setFieldValue(macro.name || `Automation Rule #${idx + 1}`, 'RULE_NAME');

      const trigger = macro.trigger || { type: 'onTap' };
      const trigType = trigger.type || 'onTap';
      ruleBlock.setFieldValue(trigType, 'TRIGGER_TYPE');

      if (trigType === 'onInfo' && trigger.infoKey) {
        ruleBlock.setFieldValue(trigger.infoKey, 'INFO_KEY');
      }
      if (trigType === 'onPolling') {
        if (trigger.url) ruleBlock.setFieldValue(trigger.url, 'POLL_URL');
        if (trigger.interval) ruleBlock.setFieldValue(Number(trigger.interval), 'POLL_INTERVAL');
      }

      ruleBlock.initSvg();
      ruleBlock.render();
      ruleBlock.moveBy(40, currentY);

      // Recursively build child actions
      const actionsInput = ruleBlock.getInput('ACTIONS');
      if (actionsInput && Array.isArray(macro.actions) && macro.actions.length > 0) {
        let parentConn = actionsInput.connection;
        this.buildActionChain(macro.actions, parentConn);
      }

      currentY += 280;
    });
  },

  // Helper to construct connected chain of actions
  buildActionChain(actionList, startConnection) {
    if (!Array.isArray(actionList) || !startConnection) return;

    let targetConnection = startConnection;

    actionList.forEach(step => {
      const type = step.type || step.action || 'set_property';
      let block = null;

      if (type === 'if-else' || type === 'if' || type === 'condition_block') {
        block = this.workspace.newBlock('ha_if_else');
        block.setFieldValue(step.condition || step.expression || 'true', 'CONDITION');
        block.initSvg();
        block.render();

        const thenConn = block.getInput('DO_THEN')?.connection;
        const elseConn = block.getInput('DO_ELSE')?.connection;

        const thenList = Array.isArray(step.thenBlocks) ? step.thenBlocks : (Array.isArray(step.then) ? step.then : []);
        const elseList = Array.isArray(step.elseBlocks) ? step.elseBlocks : (Array.isArray(step.else) ? step.else : []);

        if (thenConn && thenList.length > 0) this.buildActionChain(thenList, thenConn);
        if (elseConn && elseList.length > 0) this.buildActionChain(elseList, elseConn);

      } else if (type === 'repeat' || type === 'loop') {
        block = this.workspace.newBlock('ha_repeat');
        block.setFieldValue(Number(step.count || step.times || 2), 'COUNT');
        block.initSvg();
        block.render();

        const doConn = block.getInput('DO')?.connection;
        const bodyList = Array.isArray(step.bodyBlocks) ? step.bodyBlocks : (Array.isArray(step.body) ? step.body : (Array.isArray(step.actions) ? step.actions : []));
        if (doConn && bodyList.length > 0) this.buildActionChain(bodyList, doConn);

      } else if (type === 'set_property' || type === 'set-prop') {
        block = this.workspace.newBlock('ha_set_property');
        const prop = step.property || step.prop || step.key || 'label';
        if (this.activeWidgetProperties.includes(prop)) {
          block.setFieldValue(prop, 'PROPERTY');
        }
        block.setFieldValue(String(step.value !== undefined ? step.value : '""'), 'VALUE');
        block.initSvg();
        block.render();

      } else if (type === 'webhook') {
        block = this.workspace.newBlock('ha_webhook');
        block.setFieldValue(step.method || 'GET', 'METHOD');
        block.setFieldValue(step.url || '', 'URL');
        block.setFieldValue(step.body || step.payload || '', 'BODY');
        block.initSvg();
        block.render();

      } else if (type === 'delay') {
        block = this.workspace.newBlock('ha_delay');
        block.setFieldValue(parseFloat(step.seconds !== undefined ? step.seconds : 0.5), 'SECONDS');
        block.initSvg();
        block.render();

      } else if (type === 'toast' || type === 'notification') {
        block = this.workspace.newBlock('ha_toast');
        block.setFieldValue(step.message || step.msg || '', 'MESSAGE');
        block.initSvg();
        block.render();

      } else if (type === 'confirmation' || type === 'confirm') {
        block = this.workspace.newBlock('ha_confirm');
        block.setFieldValue(step.message || step.msg || '', 'MESSAGE');
        block.initSvg();
        block.render();
      }

      if (block && block.previousConnection && targetConnection) {
        try {
          targetConnection.connect(block.previousConnection);
          targetConnection = block.nextConnection;
        } catch (e) {
          console.warn('[Blockly Import] Failed to connect block:', e);
        }
      }
    });
  },

  // 6. Export Rules from Blockly Workspace to Clean JSON Architecture
  exportRulesToJson() {
    if (!this.workspace) return [];

    const topBlocks = this.workspace.getTopBlocks(true);
    const ruleBlocks = topBlocks.filter(b => b.type === 'ha_automation_rule');

    if (ruleBlocks.length === 0) {
      const looseActionBlocks = topBlocks.filter(b => b.type !== 'ha_automation_rule');
      if (looseActionBlocks.length > 0) {
        const extractedActions = this.extractActionChainFromBlock(looseActionBlocks[0]);
        return [{
          id: `auto_${Date.now()}`,
          name: 'Automation Rule',
          enabled: true,
          trigger: { type: 'onTap' },
          actions: extractedActions
        }];
      }
      return [];
    }

    return ruleBlocks.map((ruleBlock, idx) => {
      const ruleName = ruleBlock.getFieldValue('RULE_NAME') || `Automation Rule #${idx + 1}`;
      const triggerType = ruleBlock.getFieldValue('TRIGGER_TYPE') || 'onTap';

      const trigger = { type: triggerType };
      if (triggerType === 'onInfo') {
        trigger.infoKey = ruleBlock.getFieldValue('INFO_KEY') || '';
      } else if (triggerType === 'onPolling') {
        trigger.url = ruleBlock.getFieldValue('POLL_URL') || '';
        trigger.interval = parseFloat(ruleBlock.getFieldValue('POLL_INTERVAL')) || 1.0;
      }

      const actionsInput = ruleBlock.getInput('ACTIONS');
      let actions = [];
      if (actionsInput && actionsInput.connection && actionsInput.connection.targetBlock()) {
        actions = this.extractActionChainFromBlock(actionsInput.connection.targetBlock());
      }

      return {
        id: `auto_${Date.now()}_${idx}`,
        name: ruleName,
        enabled: true,
        trigger,
        actions
      };
    });
  },

  // Helper to extract JSON from connected chain of statement blocks
  extractActionChainFromBlock(startBlock) {
    const actions = [];
    let currentBlock = startBlock;

    while (currentBlock) {
      const type = currentBlock.type;

      if (type === 'ha_if_else') {
        const condition = currentBlock.getFieldValue('CONDITION') || 'true';
        const thenBlock = currentBlock.getInput('DO_THEN')?.connection?.targetBlock();
        const elseBlock = currentBlock.getInput('DO_ELSE')?.connection?.targetBlock();

        actions.push({
          id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: 'if-else',
          condition,
          thenBlocks: thenBlock ? this.extractActionChainFromBlock(thenBlock) : [],
          elseBlocks: elseBlock ? this.extractActionChainFromBlock(elseBlock) : []
        });

      } else if (type === 'ha_repeat') {
        const count = parseInt(currentBlock.getFieldValue('COUNT'), 10) || 2;
        const doBlock = currentBlock.getInput('DO')?.connection?.targetBlock();

        actions.push({
          id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: 'repeat',
          count,
          bodyBlocks: doBlock ? this.extractActionChainFromBlock(doBlock) : []
        });

      } else if (type === 'ha_set_property') {
        const property = currentBlock.getFieldValue('PROPERTY') || 'label';
        const value = currentBlock.getFieldValue('VALUE') || '""';

        actions.push({
          id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: 'set_property',
          property,
          value
        });

      } else if (type === 'ha_webhook') {
        const method = currentBlock.getFieldValue('METHOD') || 'GET';
        const url = currentBlock.getFieldValue('URL') || '';
        const body = currentBlock.getFieldValue('BODY') || '';

        actions.push({
          id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: 'webhook',
          method,
          url,
          body
        });

      } else if (type === 'ha_delay') {
        const seconds = parseFloat(currentBlock.getFieldValue('SECONDS')) || 0.5;

        actions.push({
          id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: 'delay',
          seconds
        });

      } else if (type === 'ha_toast') {
        const message = currentBlock.getFieldValue('MESSAGE') || '';

        actions.push({
          id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: 'toast',
          message
        });

      } else if (type === 'ha_confirm') {
        const message = currentBlock.getFieldValue('MESSAGE') || '';

        actions.push({
          id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: 'confirmation',
          message
        });
      }

      currentBlock = currentBlock.getNextBlock();
    }

    return actions;
  },

  addNewRuleBlock() {
    if (!this.workspace) return;
    const existingRules = this.workspace.getTopBlocks(false).filter(b => b.type === 'ha_automation_rule');
    const ruleBlock = this.workspace.newBlock('ha_automation_rule');
    ruleBlock.setFieldValue(`Automation Rule #${existingRules.length + 1}`, 'RULE_NAME');
    ruleBlock.setFieldValue('onTap', 'TRIGGER_TYPE');
    ruleBlock.initSvg();
    ruleBlock.render();

    const yOffset = 40 + (existingRules.length * 200);
    ruleBlock.moveBy(40, yOffset);
    if (this.workspace.centerOnBlock) {
      this.workspace.centerOnBlock(ruleBlock.id);
    }
  },

  centerWorkspace() {
    if (!this.workspace) return;
    if (this.workspace.scrollCenter) {
      this.workspace.scrollCenter();
    }
  },

  resize() {
    if (!this.workspace) return;
    if (typeof Blockly !== 'undefined' && Blockly.svgResize) {
      Blockly.svgResize(this.workspace);
    }
  }
};

window.dashboardBlocklyService = dashboardBlocklyService;
