<template>
  <div class="import-wrapper">
    <a-steps class="step-wrapper" :current="step" @change="onChangeStep">
      <a-step
        :title="isManualAuthoringMode ? 'Choose Workflow' : 'Create Brief'"
        :description="isManualAuthoringMode ? 'Manual setup' : 'Goal, audience, sources'"
      />
      <a-step
        :title="isManualAuthoringMode ? 'Optional Planner' : 'Review Plan'"
        :description="isManualAuthoringMode ? 'Sketch or skip' : 'Check AI topic plan'"
      />
    </a-steps>

    <div class="steps-content">
      <a-card v-if="step === 0" class="step-author">
        <div class="author-workflow-guide" aria-label="Authoring workflow">
          <div class="workflow-guide-header">
            <div>
              <div class="workflow-eyebrow">AI-assisted health dialogue</div>
              <h2 class="workflow-title">
                {{ isManualAuthoringMode
                  ? 'Build the ECA yourself, with an optional outline before the editor.'
                  : 'Shape the clinical brief, then let AI draft the conversation plan.' }}
              </h2>
            </div>
            <a-button data-tour="import-guide-button" size="large" @click="openOverviewModal">
              Overview
            </a-button>
          </div>
          <a-progress class="workflow-progress" :percent="authorSectionProgress" :show-info="false" />
          <div class="workflow-steps">
            <button
              type="button"
              class="workflow-step"
              :class="{ active: activeAuthorSection === 2, completed: activeAuthorSection > 2 }"
              @click="activeAuthorSection = 2"
            >
              <span class="workflow-step-number">1</span>
              <span>
                <strong>Choose workflow</strong>
                <small>Start from a generated plan or build the outline yourself.</small>
              </span>
            </button>
            <button
              v-if="!isManualAuthoringMode"
              type="button"
              class="workflow-step"
              :class="{ active: activeAuthorSection === 3, completed: activeAuthorSection > 3 }"
              @click="activeAuthorSection = 3"
            >
              <span class="workflow-step-number">2</span>
              <span>
                <strong>Define brief</strong>
                <small>Set the conversation goal, audience, and context.</small>
              </span>
            </button>
            <button
              v-if="!isManualAuthoringMode"
              type="button"
              class="workflow-step"
              :class="{ active: activeAuthorSection === 4, completed: activeAuthorSection > 4 }"
              @click="activeAuthorSection = 4"
            >
              <span class="workflow-step-number">3</span>
              <span>
                <strong>Add sources</strong>
                <small>Add the material the dialogue should follow.</small>
              </span>
            </button>
            <button
              type="button"
              class="workflow-step"
              :class="{ active: activeAuthorSection === 5 }"
              @click="activeAuthorSection = 5"
            >
              <span class="workflow-step-number">{{ isManualAuthoringMode ? '2' : '4' }}</span>
              <span>
                <strong>{{ isManualAuthoringMode ? 'Optional planner' : 'Generate plan' }}</strong>
                <small>
                  {{ isManualAuthoringMode
                    ? 'Sketch topics now, or skip straight to the dialogue editor.'
                    : 'Create the topic structure before designing the flow.' }}
                </small>
              </span>
            </button>
          </div>
        </div>

        <div v-if="activeAuthorSection === 2" class="workflow-mode-panel" data-tour="import-workflow-mode">
          <div>
            <div class="section-kicker">2. Choose workflow</div>
            <h2 class="authoring-panel-title">Choose how to create the conversation structure</h2>
            <p class="authoring-panel-caption">
              Choose AI-Assisted if you want the system to draft a topic plan from your materials.
              Choose Manual Authoring if you want to build every topic, state, option, and transition yourself.
            </p>
          </div>
          <div class="mode-choice-layout">
            <div class="workflow-mode-card">
              <div class="authoring-mode-label">Authoring mode</div>
              <a-radio-group
                :value="authoringMode"
                :options="authoringModeOptions"
                option-type="button"
                button-style="solid"
                size="large"
                @update:value="updateAuthoringMode"
              />
              <p class="mode-helper">
                {{ isManualAuthoringMode
                  ? 'Manual Authoring: no AI assistance is used. You create the topics, states, options, and transitions yourself.'
                  : 'AI-Assisted: the system drafts a topic plan from your task and reference material. You still review and edit the full dialogue.' }}
              </p>
            </div>
            <a-button
              type="primary"
              size="large"
              @click="isManualAuthoringMode ? (activeAuthorSection = 5) : (activeAuthorSection = 3)"
            >
              {{ isManualAuthoringMode ? 'Continue to Optional Planner' : 'Continue to Brief' }}
            </a-button>
          </div>
        </div>

        <div v-if="!isManualAuthoringMode && activeAuthorSection === 3" class="authoring-panel" data-tour="import-brief">
          <div class="authoring-panel-header">
            <div>
              <div class="section-kicker">3. Define the conversation brief</div>
              <h2 class="authoring-panel-title">Goal and target user</h2>
              <p class="authoring-panel-caption">
                Tell the system what the dialogue should accomplish and who it is for. This helps
                the plan choose the right topics, tone, and level of support.
              </p>
            </div>
          </div>

          <div v-if="isManualAuthoringMode" class="manual-authoring-guide">
            <div class="manual-authoring-guide-title">How Manual Authoring Works</div>
            <div class="manual-authoring-guide-copy">
              In this mode, the system does not generate topics or dialogue for you. First define
              the task, user, and reference material here. Then add the topics and subtopics
              yourself in the next step, set the conversation route, and finally write the dialogue
              states by hand in the dialogue editor.
            </div>
          </div>

          <a-form layout="vertical" class="authoring-form">
            <div class="task-form-sections">
              <div class="task-form-section goal-section">
                <div class="form-section-header">
                  <h3>Dialogue goal</h3>
                  <p>Choose what the conversation should mainly help the user do.</p>
                </div>
                <a-form-item label="Goal" required>
                  <a-select
                    v-model:value="goalValue"
                    :options="goalSelectOptions"
                    :placeholder="
                      isManualAuthoringMode
                        ? 'Choose the dialogue goal. Eg Education & Persuasion'
                        : 'Select a goal'
                    "
                    size="large"
                  />
                  <div class="field-help">
                    This guides the topic plan. For example, education explains facts, persuasion
                    helps users consider action, and mixed goals balance both.
                  </div>
                </a-form-item>
              </div>

              <div class="task-form-section target-user-section">
                <div class="form-section-header">
                  <h3>Target user</h3>
                  <p>Describe who the dialogue is written for so the tone, examples, and support level fit.</p>
                </div>
                <div class="target-user-grid">
                  <a-form-item label="Age Range">
                    <a-space align="center" class="age-range">
                      <a-input-number
                        v-model:value="ageMinValue"
                        :min="0"
                        :placeholder="isManualAuthoringMode ? 'e.g. 30' : 'Min'"
                        size="large"
                      />
                      <span class="divider">to</span>
                      <a-input-number
                        v-model:value="ageMaxValue"
                        :min="0"
                        :placeholder="isManualAuthoringMode ? 'e.g. 65' : 'Max'"
                        size="large"
                      />
                    </a-space>
                    <div class="field-help">
                      Optional. Helps adjust examples, reading level, and screening context.
                    </div>
                  </a-form-item>
                  <a-form-item label="Gender">
                    <a-input
                      v-model:value="genderValue"
                      :placeholder="
                        isManualAuthoringMode ? 'e.g. women with a cervix' : 'Optional'
                      "
                      size="large"
                    />
                    <div class="field-help">
                      Optional. Use when gender or anatomy affects the health context.
                    </div>
                  </a-form-item>
                  <a-form-item label="Persona" class="persona-row">
                    <a-textarea
                      v-model:value="personaValue"
                      :rows="3"
                      :placeholder="
                        isManualAuthoringMode
                          ? 'Describe the user you are writing for. Eg 45-year-old hesitant about screening, busy, wants calm and simple language.'
                          : 'Describe the target user. Include background, mindset, concerns, barriers, motivation, or communication preferences.'
                      "
                      size="large"
                    />
                    <div class="field-help">
                      Most important user detail. This helps the AI choose realistic concerns,
                      supportive wording, and better topic order.
                    </div>
                  </a-form-item>
                </div>
              </div>
            </div>
          </a-form>
          <div class="section-actions">
            <a-button size="large" @click="activeAuthorSection = 2">Back</a-button>
            <a-button type="primary" size="large" @click="activeAuthorSection = 4">
              Continue to Materials
            </a-button>
          </div>
        </div>

        <div v-if="!isManualAuthoringMode && activeAuthorSection === 4" class="knowledge-panel" data-tour="import-sources">
          <div class="knowledge-panel-header">
            <div class="section-kicker">4. Add source material</div>
            <h2 class="knowledge-panel-title">Sources for the dialogue</h2>
            <p class="knowledge-panel-caption">
              Add the facts, guidelines, script examples, or notes the dialogue should follow.
              Better source material produces a more useful topic plan.
            </p>
          </div>

          <div class="convert-type-section">
            <div class="convert-type-header">
              <div>
                <span class="section-title">Main source</span>
                <p class="section-helper">Use one of these to provide the main content for the plan.</p>
              </div>
              <div class="input-mode-control">
                <a-radio-group v-model:value="type" button-style="solid" size="large">
                  <a-radio-button :value="convertType.TEXT">Paste Text</a-radio-button>
                  <a-radio-button :value="convertType.IMPORT">Upload File</a-radio-button>
                </a-radio-group>
                <p class="control-helper">
                  {{ type === convertType.TEXT
                    ? 'Paste Text: best for notes, guidelines, or short script examples.'
                    : 'Upload File: best when the reference material is already saved as a text file.' }}
                </p>
              </div>
            </div>
            <div class="input-area">
              <a-textarea
                v-if="type === convertType.TEXT"
                v-model:value="convertContent"
                @paste="onReferenceTextPaste"
                :placeholder="
                  isManualAuthoringMode
                    ? 'Paste the professional knowledge or script reference you want to rely on. Eg screening guidelines, workflow notes, sample counseling lines, or education content.'
                    : 'Paste the professional knowledge, script excerpts, educational content, notes, or guideline text that this dialogue should rely on for topic accuracy and factual grounding.'
                "
                :rows="7"
              />
              <a-upload-dragger
                v-else
                v-model:fileList="fileList"
                name="file"
                :multiple="false"
                :customRequest="onCustomRequest"
                :showUploadList="true"
                @change="handleChange"
              >
                <p class="ant-upload-drag-icon">
                  <inbox-outlined />
                </p>
                <p class="ant-upload-text">Click or drag a reference file here to upload</p>
                <p class="ant-upload-hint">Supported: plain text, UTF-8</p>
              </a-upload-dragger>
            </div>
          </div>

          <div class="reference-image-section">
            <div class="reference-image-header">
              <div>
                <div class="section-title">Optional image reference</div>
                <p class="reference-image-caption">
                  Use this only when useful information is in a screenshot, slide, table, or image.
                  The system extracts text from the image and adds it to the reference material.
                </p>
              </div>
              <a-button size="large" @click="openReferenceImagePicker">Upload Image</a-button>
            </div>

            <div
              class="reference-image-paste-zone"
              tabindex="0"
              @click="focusReferenceImagePasteTarget"
              @keydown.enter.prevent="focusReferenceImagePasteTarget"
              @keydown.space.prevent="focusReferenceImagePasteTarget"
              @paste="onReferenceImagePaste"
            >
              <textarea
                ref="referenceImagePasteRef"
                class="reference-image-paste-input"
                aria-label="Paste reference image here"
                @paste.stop="onReferenceImagePaste"
              />
              <div class="reference-image-paste-title">Paste a screenshot here</div>
              <div class="reference-image-paste-hint">
                Click this box, then press {{ pasteShortcutLabel }}. If your browser does not allow
                image paste, use Upload Image instead. Skip this section if your material is typed above.
              </div>
            </div>

            <input
              ref="referenceImageInputRef"
              class="reference-image-input"
              type="file"
              accept="image/*"
              multiple
              @change="onReferenceImageInputChange"
            />

            <div v-if="referenceImageItems.length" class="reference-image-list">
              <div
                v-for="item in referenceImageItems"
                :key="item.id"
                class="reference-image-item"
                :class="item.status"
              >
                <img :src="item.dataUrl" :alt="item.name" class="reference-image-preview" />
                <div class="reference-image-content">
                  <div class="reference-image-name">{{ item.name }}</div>
                  <div v-if="item.status === 'processing'" class="reference-image-status">
                    Extracting text from image...
                  </div>
                  <div v-else-if="item.status === 'error'" class="reference-image-status error">
                    {{ item.error || 'Image extraction failed.' }}
                  </div>
                  <div v-else class="reference-image-status success">
                    Added to reference material.
                  </div>
                  <div v-if="item.extractedText" class="reference-image-snippet">
                    {{ item.extractedText }}
                  </div>
                  <div class="reference-image-actions">
                    <a-button
                      v-if="item.status === 'error'"
                      size="middle"
                      @click="retryReferenceImage(item.id)"
                    >
                      Retry
                    </a-button>
                    <a-button size="middle" @click="removeReferenceImage(item.id)">Remove</a-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="section-actions">
            <a-button size="large" @click="activeAuthorSection = 3">Back</a-button>
            <a-button type="primary" size="large" @click="activeAuthorSection = 5">
              Continue to Review
            </a-button>
          </div>
        </div>

        <div v-if="activeAuthorSection === 5" class="review-start-panel" data-tour="import-generate-plan">
          <div>
            <div class="section-kicker">
              {{ isManualAuthoringMode ? '2. Optional planner' : '5. Generate the topic plan' }}
            </div>
            <h2 class="authoring-panel-title">
              {{ isManualAuthoringMode ? 'Sketch an outline, or skip to the editor' : 'Generate the topic plan' }}
            </h2>
            <p class="authoring-panel-caption">
              {{ isManualAuthoringMode
                ? 'The planner is optional. Use it to sketch topics and subtopics before writing the dialogue, or skip it and build directly in the dialogue design editor.'
                : 'Next, the system will draft a topic plan from your task, target user, and reference material. You can review the plan before opening the dialogue editor.' }}
            </p>
          </div>
          <div class="author-footer-copy">
            <strong>Next:</strong>
            {{ isManualAuthoringMode
              ? 'You can add, rename, delete, and reorganize topics later in the dialogue design editor. This outline is only a starting point.'
              : 'Generate a topic plan, review it, then open the dialogue editor to inspect every state, test with Agent Preview, and export when ready.' }}
          </div>
          <div class="section-actions">
            <a-button size="large" @click="isManualAuthoringMode ? (activeAuthorSection = 2) : (activeAuthorSection = 4)">
              {{ isManualAuthoringMode ? 'Back to Workflow' : 'Back to Materials' }}
            </a-button>
            <a-button
              v-if="isManualAuthoringMode"
              size="large"
              @click="onGenerateDialogue"
            >
              Skip to Dialogue Editor
            </a-button>
            <a-button
              type="primary"
              size="large"
              :loading="convertLoading"
              @click="onConvertToTopic"
            >
              {{ isManualAuthoringMode ? 'Open Optional Planner' : 'Generate Topic Plan' }}
            </a-button>
          </div>
        </div>
      </a-card>

      <a-card v-else class="step-review">
        <div v-if="reviewLoadingActive" class="review-loading-panel">
          <div class="review-loading-card">
            <div class="review-loading-visual" aria-hidden="true">
              <div class="loading-doc"></div>
              <div class="loading-spark one"></div>
              <div class="loading-spark two"></div>
              <div class="loading-spark three"></div>
            </div>
            <div class="review-loading-copy">
              <div class="review-loading-kicker">Working on your dialogue</div>
              <h2>{{ reviewLoadingTitle }}</h2>
              <p>{{ reviewLoadingDescription }}</p>
            </div>
            <a-progress
              class="review-loading-progress"
              :percent="reviewLoadingPercent"
              :show-info="false"
              status="active"
            />
            <div class="review-loading-steps">
              <div
                class="review-loading-step"
                :class="{ active: convertLoading, complete: queryTopicStrucLoading }"
              >
                <span>1</span>
                <strong>Read your task</strong>
                <small>Using the goal, target user, and reference material.</small>
                <div class="loading-learning-note">
                  <b>ECA</b>
                  <p>An Embodied Conversational Agent is a virtual person that delivers the dialogue through messages and choices.</p>
                </div>
              </div>
              <div
                class="review-loading-step"
                :class="{ active: convertLoading, complete: queryTopicStrucLoading }"
              >
                <span>2</span>
                <strong>Create the topic plan</strong>
                <small>Organizing the conversation into clear topics and subtopics.</small>
                <div class="loading-learning-note">
                  <b>Health coach dialogue</b>
                  <p>A good plan has a clear beginning, supportive education, room for patient concerns, and an actionable next step.</p>
                </div>
              </div>
              <div class="review-loading-step" :class="{ active: queryTopicStrucLoading }">
                <span>3</span>
                <strong>Prepare the next screen</strong>
                <small>Getting the dialogue editor ready after the plan is approved.</small>
                <div class="loading-learning-note">
                  <b>MI review</b>
                  <p>Motivational Interviewing focuses on autonomy, empathy, open questions, reflections, and patient-centered choices.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <template v-else>
          <div v-if="isManualAuthoringMode || reviewTopics.length" class="review-reviewer">
            <div v-if="isManualAuthoringMode" class="manual-review-guide">
              <div class="manual-review-guide-title">Optional Planner</div>
              <div class="manual-review-guide-copy">
                Use this planner only if you want to sketch topics and subtopics before designing
                the dialogue. You can skip it now, and you can add, rename, delete, or reorganize
                topics later in the dialogue design editor.
              </div>
            </div>
            <div class="plan-review-hero" data-tour="plan-review-overview">
              <div class="plan-review-copy">
                <div class="review-eyebrow">{{ isManualAuthoringMode ? 'Optional Planner' : 'Topic Plan Review' }}</div>
                <h2 class="plan-review-title">
                  {{ isManualAuthoringMode ? 'Sketch an outline, or skip to the editor.' : 'Review and refine the conversation plan.' }}
                </h2>
                <p class="plan-review-caption">
                  {{ isManualAuthoringMode
                    ? 'This outline is only a starting point. The dialogue design editor is where you build and revise the actual states, options, and transitions.'
                    : 'Check topics, subtopics, route logic, and counseling intent before generating the editable state flow.' }}
                </p>
              </div>
              <div v-if="!isManualAuthoringMode" class="plan-ai-mini">
                <span>AI revision available</span>
                <strong>Ask for targeted changes, then review the result.</strong>
              </div>
              <div class="plan-review-stats" aria-label="Topic plan summary" data-tour="plan-summary-stats">
                <div class="plan-stat">
                  <span class="plan-stat-value">{{ reviewTopics.length }}</span>
                  <span class="plan-stat-label">topics</span>
                </div>
                <div class="plan-stat">
                  <span class="plan-stat-value">{{ totalSubtopicCount }}</span>
                  <span class="plan-stat-label">subtopics</span>
                </div>
                <div class="plan-stat">
                  <span class="plan-stat-value">{{ branchRouteCount }}</span>
                  <span class="plan-stat-label">branches</span>
                </div>
              </div>
              <a-button
                data-tour="plan-guide-button"
                size="large"
                :class="{ 'guide-attention-pulse': shouldPulsePlanGuide }"
                @click="onStartPlanGuide"
              >
                Guide
              </a-button>
            </div>

            <div v-if="!isManualAuthoringMode" class="ai-plan-panel" data-tour="plan-ai-revise">
              <div class="ai-plan-panel-header">
                <div>
                  <h3 class="ai-plan-title">Inline AI revision</h3>
                  <p class="ai-plan-caption">
                    Tell the planner what should change across the whole structure.
                  </p>
                </div>
              </div>
              <div class="ai-command-row" data-tour="plan-ai-revise-input">
                <a-textarea
                  v-model:value="newConvertContent"
                  :rows="2"
                  placeholder="Ask for a clearer plan, warmer counseling tone, simpler topic order, or more patient-centered structure..."
                />
                <a-button
                  type="primary"
                  size="large"
                  :disabled="!sessionTopics.length"
                  :loading="convertLoading"
                  @click="onRegenerate"
                >
                  Apply
                </a-button>
              </div>
              <div class="revision-preset-row">
                <button type="button" class="revision-preset" @click="applyGlobalRevisionTemplate('beginner')">
                  Make it easier for new users
                </button>
                <button type="button" class="revision-preset" @click="applyGlobalRevisionTemplate('patient')">
                  More patient-centered
                </button>
                <button type="button" class="revision-preset" @click="applyGlobalRevisionTemplate('shorter')">
                  Simplify and shorten
                </button>
              </div>
            </div>

            <details v-if="reviewRoutes.length" class="advanced-route-disclosure">
              <summary data-tour="plan-route-settings">
                <span class="advanced-route-title">Advanced route settings</span>
                <span class="advanced-route-summary">
                  Entry: {{ getTopicDisplayNameByName(routingPlan.entryTopic) }}
                  <template v-if="routeIssueMessages.length">
                    · {{ routeIssueMessages.length }} needs attention
                  </template>
                </span>
              </summary>
              <div class="route-summary-card">
                <div class="route-summary-header">
                  <div>
                    <h3 class="route-summary-title">Conversation route</h3>
                    <p class="route-summary-caption">
                      Use this only when you need to change the order, ending, or branching between topics.
                    </p>
                  </div>
                  <div class="route-entry-select">
                    <div class="route-field-label">Entry Topic</div>
                    <a-select
                      :value="routingPlan.entryTopic"
                      :options="reviewTopicOptions"
                      size="middle"
                      @update:value="onUpdateEntryTopic"
                    />
                  </div>
                </div>
                <div v-if="routeIssueMessages.length" class="route-issues">
                  <div class="route-issues-title">Needs attention</div>
                  <ul>
                    <li v-for="issue in routeIssueMessages" :key="issue">{{ issue }}</li>
                  </ul>
                </div>
                <div class="route-list">
                  <div
                    v-for="(route, routeIndex) in reviewRoutes"
                    :key="route.topicName"
                    class="route-summary-item"
                    :class="{
                      active: currentTopic?.topicName === route.topicName,
                      branch: route.transition === 'branch',
                      end: route.transition === 'end',
                    }"
                  >
                    <button
                      type="button"
                      class="route-summary-focus"
                      @click="onSelectRouteTopic(route.topicName)"
                    >
                      <span class="route-step-number">{{ routeIndex + 1 }}</span>
                      <span class="route-step-content">
                        <span class="route-step-title">
                          {{ route.displayName }}
                          <span v-if="route.topicName === routingPlan.entryTopic" class="route-entry-badge">
                            Entry
                          </span>
                        </span>
                        <span class="route-step-description">{{ describeRoute(route) }}</span>
                      </span>
                    </button>
                    <div class="route-summary-controls">
                      <div class="route-control-field">
                        <div class="route-field-label">After this topic</div>
                        <a-select
                          :value="route.transition"
                          :options="routeTransitionOptions"
                          size="middle"
                          @update:value="onUpdateRouteTransition(route.topicName, $event)"
                        />
                      </div>
                      <div v-if="route.transition === 'direct'" class="route-control-field">
                        <div class="route-field-head">
                          <div class="route-field-label">Next topic</div>
                          <button type="button" class="route-link-action" @click="onClearRouteTargets(route.topicName)">
                            Clear
                          </button>
                        </div>
                        <a-select
                          :value="route.nextTopics[0]"
                          :options="getRoutingTargetOptions(route.topicName)"
                          allow-clear
                          size="middle"
                          placeholder="Choose the next topic"
                          @update:value="onUpdateDirectNextTopic(route.topicName, $event)"
                        />
                      </div>
                      <template v-else-if="route.transition === 'branch'">
                        <div class="route-control-field route-control-wide">
                          <div class="route-field-head">
                            <div class="route-field-label">Branch topics</div>
                            <button type="button" class="route-link-action" @click="onClearRouteTargets(route.topicName)">
                              Clear
                            </button>
                          </div>
                          <a-select
                            mode="multiple"
                            :value="route.nextTopics"
                            :options="getRoutingTargetOptions(route.topicName)"
                            size="middle"
                            placeholder="Choose topics users can branch to"
                            @update:value="onUpdateBranchNextTopics(route.topicName, $event)"
                          />
                        </div>
                        <div v-if="route.branchMenu.length" class="branch-label-list route-control-wide">
                          <div
                            v-for="choice in route.branchMenu"
                            :key="`${route.topicName}-${choice.targetTopic}`"
                            class="branch-label-item"
                          >
                            <div class="branch-target">{{ choice.targetDisplayName }}</div>
                            <a-input
                              :value="choice.label"
                              size="middle"
                              placeholder="Patient-facing choice label"
                              @update:value="onUpdateBranchLabel(route.topicName, choice.targetTopic, $event)"
                            />
                          </div>
                        </div>
                      </template>
                      <div v-else class="route-end-note route-control-wide">
                        This is the final topic in the conversation.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </details>

            <div class="review-layout" data-tour="plan-review-layout">
            <div class="review-navigation" data-tour="plan-topic-tree">
              <div class="review-navigation-header">
                <div>
                  <h3 class="review-navigation-title">
                    {{ isManualAuthoringMode ? 'Planner topics' : 'Topics in this plan' }}
                  </h3>
                  <p class="review-navigation-caption">
                    {{ isManualAuthoringMode
                      ? 'Add topics if an outline helps. You can also skip this planner.'
                      : 'Select a topic to read and revise its subtopics.' }}
                  </p>
                </div>
              </div>
              <div v-if="isManualAuthoringMode" class="manual-topic-toolbar">
                <a-button type="primary" size="large" @click="openManualTopicEditorForCreate">
                  Add Topic
                </a-button>
                <a-button
                  v-if="currentTopic"
                  size="large"
                  @click="openManualTopicEditorForEdit(currentTopic)"
                >
                  Edit Topic
                </a-button>
                <a-popconfirm
                  v-if="currentTopic"
                  title="Delete this topic and its route links?"
                  ok-text="Delete"
                  cancel-text="Cancel"
                  @confirm="deleteCurrentManualTopic"
                >
                  <a-button danger size="large">Delete Topic</a-button>
                </a-popconfirm>
              </div>
              <div class="topic-tree">
                <div
                  v-for="(topic, topicIndex) in reviewTopics"
                  :key="getTopicKey(topicIndex)"
                  class="topic-node"
                >
                  <button
                    type="button"
                    class="topic-button"
                    :data-tour="topicIndex === 0 ? 'plan-topic-button' : undefined"
                    :class="{ active: isActiveTopic(topicIndex) }"
                    @click="onToggleTopic(topicIndex)"
                  >
                    <span class="topic-label">{{ topic.displayName }}</span>
                    <span class="topic-toggle-icon">
                      <DownOutlined v-if="isTopicExpanded(topicIndex)" />
                      <RightOutlined v-else />
                    </span>
                  </button>
                  <ul v-show="isTopicExpanded(topicIndex)" class="subtopic-list">
                    <li
                      v-for="(subtopic, subtopicIndex) in topic.subtopics"
                      :key="getSubtopicKey(topicIndex, subtopicIndex)"
                      class="subtopic-item"
                    >
                      <button
                        type="button"
                        class="subtopic-button"
                        :data-tour="topicIndex === activeSelection.topicIndex && subtopicIndex === 0 ? 'plan-subtopic-button' : undefined"
                        :class="{ active: isActiveSubtopic(topicIndex, subtopicIndex) }"
                        @click="onSelectSubtopic(topicIndex, subtopicIndex)"
                      >
                        {{ subtopic.displayName }}
                      </button>
                    </li>
                    <li v-if="!topic.subtopics.length" class="subtopic-item subtopic-empty">
                      No subtopics for this topic yet.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div class="review-detail">
              <div v-if="currentTopic" class="detail-card">
                <div class="detail-header">
                  <h2 class="detail-title">{{ currentTopic.displayName }}</h2>
                  <div v-if="isManualAuthoringMode" class="detail-header-actions">
                    <a-button size="middle" @click="openManualTopicEditorForEdit(currentTopic)">
                      Edit Topic
                    </a-button>
                  </div>
                </div>
                <details v-if="!isManualAuthoringMode" class="revision-disclosure topic-revision-disclosure">
                  <summary>
                    <span>Revise this topic with AI</span>
                    <span class="revision-summary-hint">Optional</span>
                  </summary>
                  <div class="direction-editor topic-direction-editor">
                    <div class="direction-header">
                      <div>
                        <div class="direction-label">What should change?</div>
                        <div class="direction-help">This only regenerates the selected topic.</div>
                      </div>
                      <a-button
                        type="primary"
                        size="small"
                        :loading="isTopicRegenerating(currentTopic)"
                        @click="onRegenerateTopic(currentTopic)"
                      >
                        Regenerate Topic
                      </a-button>
                    </div>
                    <a-textarea
                      :value="currentTopic.topicPrompt"
                      :rows="3"
                      placeholder="Example: Make this topic warmer, clearer, and easier for a first-time patient."
                      @update:value="handleTopicPromptInput(activeSelection.topicIndex, $event)"
                    />
                    <div class="revision-preset-row compact">
                      <button type="button" class="revision-preset" @click="applyTopicRevisionTemplate('clearer')">
                        Clarify goal
                      </button>
                      <button type="button" class="revision-preset" @click="applyTopicRevisionTemplate('empathetic')">
                        Add empathy
                      </button>
                      <button type="button" class="revision-preset" @click="applyTopicRevisionTemplate('actionable')">
                        Add next step
                      </button>
                    </div>
                  </div>
                </details>
                <div v-if="currentSubtopics.length" class="detail-subtopics">
                  <div
                    v-for="(subtopic, index) in currentSubtopics"
                    :key="getSubtopicKey(activeSelection.topicIndex, index)"
                    class="subtopic-detail"
                    data-tour="plan-subtopic-detail"
                    :ref="setSubtopicRef(getSubtopicKey(activeSelection.topicIndex, index))"
                  >
                    <h3 class="subtopic-title">{{ subtopic.displayName }}</h3>
                    <p class="subtopic-brief" v-if="subtopic.brief">
                      {{ subtopic.brief }}
                    </p>
                    <p class="subtopic-brief placeholder" v-else>
                      No brief provided.
                    </p>
                    <div class="subtopic-mi">
                      <span class="label">Motivational Interview Technique:</span>
                      <span class="value">{{ subtopic.miTechnique || 'Pending refinement.' }}</span>
                    </div>
                    <details v-if="!isManualAuthoringMode" class="revision-disclosure subtopic-revision-disclosure">
                      <summary>
                        <span>Revise with AI</span>
                        <span class="revision-summary-hint">Optional</span>
                      </summary>
                      <div class="direction-editor subtopic-direction-editor">
                        <div class="direction-header">
                          <div>
                            <div class="direction-label">What should change?</div>
                            <div class="direction-help">This only regenerates this subtopic.</div>
                          </div>
                          <a-button
                            size="small"
                            :loading="isSubtopicRegenerating(currentTopic, subtopic)"
                            @click="onRegenerateSubtopic(currentTopic, subtopic)"
                          >
                            Regenerate
                          </a-button>
                        </div>
                        <a-textarea
                          :value="subtopic.prompt"
                          :rows="2"
                          placeholder="Example: Use simpler wording, or address common patient concerns."
                          @update:value="handleSubtopicPromptInput(activeSelection.topicIndex, index, $event)"
                        />
                        <div class="revision-preset-row compact">
                          <button
                            type="button"
                            class="revision-preset"
                            @click="applySubtopicRevisionTemplate(index, 'plain')"
                          >
                            Simpler wording
                          </button>
                          <button
                            type="button"
                            class="revision-preset"
                            @click="applySubtopicRevisionTemplate(index, 'barrier')"
                          >
                            Address concerns
                          </button>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
                <div v-else class="detail-empty">This topic does not have any subtopics yet.</div>
              </div>
              <a-empty
                v-else
                :description="
                  isManualAuthoringMode
                    ? 'No topics yet. Add a topic here, or skip and build directly in the dialogue editor.'
                    : 'Select a subtopic to see details.'
                "
              />
            </div>
          </div>
          </div>
          <div v-else class="manual-empty-review">
            <a-empty
              :description="
                isManualAuthoringMode
                  ? 'No topics yet. Add your first topic to start manual authoring.'
                  : 'Generate a topic plan to review.'
              "
            />
            <a-button
              v-if="isManualAuthoringMode"
              size="large"
              @click="openManualTopicEditorForCreate"
            >
              Add Topic
            </a-button>
            <a-button
              v-if="isManualAuthoringMode"
              type="primary"
              size="large"
              @click="onGenerateDialogue"
            >
              Skip to Dialogue Editor
            </a-button>
          </div>

          <div class="review-footer">
            <div class="actions">
              <a-button size="large" @click="onBack">Back</a-button>
              <a-button
                v-if="!isManualAuthoringMode"
                size="large"
                :disabled="!sessionTopics.length"
                :loading="convertLoading"
                @click="onRegenerate"
              >
                Regenerate
              </a-button>
              <a-button
                type="primary"
                size="large"
                data-tour="plan-generate-dialogue"
                :disabled="!canOpenDialogueEditor"
                :loading="queryTopicStrucLoading"
                @click="onGenerateDialogue"
              >
                {{ isManualAuthoringMode
                  ? (reviewTopics.length ? 'Open Dialogue Editor' : 'Skip to Dialogue Editor')
                  : 'Generate Dialogue' }}
              </a-button>
            </div>
          </div>
        </template>
      </a-card>
    </div>
  </div>
  <div
    v-if="importTourActive && currentImportTourStep"
    class="import-tour-overlay"
    :class="{ 'planning-tour-overlay': importTourMode === 'plan' }"
    role="dialog"
    aria-modal="true"
    aria-label="HealthDial Studio guide"
  >
    <div class="import-tour-highlight" :style="importTourHighlightStyle"></div>
    <div class="import-tour-card" :style="importTourCardStyle">
      <div class="import-tour-step-count">
        Step {{ importTourStepIndex + 1 }} of {{ activeImportTourSteps.length }}
      </div>
      <h2>{{ currentImportTourStep.title }}</h2>
      <p>{{ currentImportTourStep.body }}</p>
      <div v-if="currentImportTourStep.note" class="import-tour-note">
        {{ currentImportTourStep.note }}
      </div>
      <div class="import-tour-actions">
        <a-button @click="endImportTour">Skip</a-button>
        <a-button :disabled="importTourStepIndex === 0" @click="previousImportTourStep">
          Back
        </a-button>
        <a-button
          type="primary"
          @click="importTourStepIndex === activeImportTourSteps.length - 1 ? endImportTour() : nextImportTourStep()"
        >
          {{ importTourStepIndex === activeImportTourSteps.length - 1 ? 'Done' : 'Next' }}
        </a-button>
      </div>
    </div>
  </div>
  <a-modal
    v-model:open="overviewModalOpen"
    width="1040px"
    class="overview-modal"
    :footer="null"
    centered
  >
    <div class="overview-modal-content">
      <div class="overview-modal-tabs" aria-label="Overview steps">
        <button
          v-for="(feature, index) in overviewFeatures"
          :key="feature.key"
          type="button"
          class="overview-modal-tab"
          :class="{ active: overviewFeatureIndex === index }"
          @click="overviewFeatureIndex = index"
        >
          <span>{{ index + 1 }}</span>
          <span class="overview-modal-tab-text">
            <strong>{{ feature.navTitle }}</strong>
            <small>{{ feature.kicker }}</small>
          </span>
        </button>
      </div>

      <div class="overview-modal-main">
        <div class="overview-modal-copy">
          <div class="section-kicker">{{ activeOverviewFeature.kicker }}</div>
          <h2>{{ activeOverviewFeature.title }}</h2>
          <p v-if="'descriptionHtml' in activeOverviewFeature" v-html="activeOverviewFeature.descriptionHtml"></p>
          <p v-else>{{ activeOverviewFeature.description }}</p>
          <p v-if="'detailHtml' in activeOverviewFeature" v-html="activeOverviewFeature.detailHtml"></p>
          <p v-else>{{ activeOverviewFeature.detail }}</p>
        </div>

        <div class="overview-modal-feature">
          <div v-if="activeOverviewFeature.hasImage" class="overview-modal-frame">
            <img
              :class="`overview-image-${activeOverviewFeature.key}`"
              :src="resolvePublicAsset(activeOverviewFeature.image)"
              :alt="activeOverviewFeature.alt"
            />
          </div>
          <div class="overview-modal-feature-copy">
            <h3>{{ activeOverviewFeature.captionTitle }}</h3>
            <p v-if="'captionHtml' in activeOverviewFeature" v-html="activeOverviewFeature.captionHtml"></p>
            <p v-else>{{ activeOverviewFeature.caption }}</p>
          </div>
        </div>

        <div class="overview-modal-actions">
          <a-button @click="overviewModalOpen = false">Close</a-button>
          <a-button
            v-if="overviewFeatureIndex > 0"
            @click="overviewFeatureIndex = Math.max(overviewFeatureIndex - 1, 0)"
          >
            Back
          </a-button>
          <a-button
            type="primary"
            @click="
              overviewFeatureIndex === overviewFeatures.length - 1
                ? (overviewModalOpen = false)
                : (overviewFeatureIndex = Math.min(overviewFeatureIndex + 1, overviewFeatures.length - 1))
            "
          >
            {{ overviewFeatureIndex === overviewFeatures.length - 1 ? 'Start' : 'Next' }}
          </a-button>
        </div>
      </div>
    </div>
  </a-modal>
  <a-modal
    :open="manualTopicEditor.visible"
    :title="manualTopicEditor.mode === 'create' ? 'Add Topic' : 'Edit Topic'"
    width="920px"
    destroyOnClose
    @cancel="resetManualTopicEditor"
  >
    <div class="manual-topic-editor">
      <a-alert
        v-if="manualTopicEditor.error"
        class="manual-topic-editor-alert"
        type="error"
        :message="manualTopicEditor.error"
        show-icon
      />
      <a-form layout="vertical">
        <a-form-item label="Topic Name" required>
          <a-input
            v-model:value="manualTopicEditor.topicName"
            size="large"
            placeholder="e.g. Opening the Conversation"
          />
        </a-form-item>
        <a-form-item label="Topic Notes">
          <a-textarea
            v-model:value="manualTopicEditor.topicPrompt"
            :rows="3"
            placeholder="What should this topic cover? Eg welcome the user, set the purpose, and invite their first reaction."
          />
        </a-form-item>
      </a-form>

      <div class="manual-topic-editor-subtopics">
        <div class="manual-topic-editor-subtopics-header">
          <h3>Subtopics</h3>
          <a-button size="middle" @click="addManualEditorSubtopic">Add Subtopic</a-button>
        </div>
        <div
          v-for="(subtopic, index) in manualTopicEditor.subtopics"
          :key="subtopic.id"
          class="manual-topic-editor-subtopic"
        >
          <div class="manual-topic-editor-subtopic-head">
            <span>Subtopic {{ index + 1 }}</span>
            <a-button danger type="link" @click="removeManualEditorSubtopic(subtopic.id)">
              Remove
            </a-button>
          </div>
          <a-form layout="vertical">
            <a-form-item label="Subtopic Name" required>
              <a-input
                v-model:value="subtopic.name"
                size="large"
                placeholder="e.g. Warm Greeting"
              />
            </a-form-item>
            <a-form-item label="Brief Description">
              <a-textarea
                v-model:value="subtopic.brief"
                :rows="2"
                placeholder="What should happen here? Eg acknowledge nerves and invite the user's first reaction."
              />
            </a-form-item>
            <a-form-item label="MI Technique">
              <a-input
                v-model:value="subtopic.miTechnique"
                size="large"
                placeholder="e.g. Open Question, Reflection, Summary"
              />
            </a-form-item>
          </a-form>
        </div>
      </div>
    </div>
    <template #footer>
      <a-button @click="resetManualTopicEditor">Cancel</a-button>
      <a-button type="primary" @click="saveManualTopicEditor">Save Topic</a-button>
    </template>
  </a-modal>
  <a-modal
    v-model:open="userNameModalVisible"
    title="Set workspace user"
    :closable="!userNameModalRequired"
    :maskClosable="!userNameModalRequired"
    destroyOnClose
    @cancel="handleUserNameCancel"
  >
    <p class="user-modal-desc">
      Enter a user name to open that user's workspace. Using the same name resumes that thread;
      a new name starts a blank one.
    </p>
    <a-form layout="vertical">
      <a-form-item
        label="User name"
        :validate-status="userNameError ? 'error' : ''"
        :help="userNameError || ''"
      >
        <a-input
          v-model:value="pendingUserName"
          placeholder="Enter your name, e.g. Test_01"
          @pressEnter="handleUserNameSubmit"
        />
      </a-form-item>
    </a-form>
    <template #footer>
      <div class="user-modal-footer">
        <a-button v-if="!userNameModalRequired" @click="handleUserNameCancel">Cancel</a-button>
        <a-button type="primary" @click="handleUserNameSubmit">Save</a-button>
      </div>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message, type UploadChangeParam, type UploadProps } from 'ant-design-vue'
import { InboxOutlined, DownOutlined, RightOutlined } from '@ant-design/icons-vue'
import { storeToRefs } from 'pinia'

import {
  ConvertType,
  AuthoringMode,
  AuthoringGoal,
  useDesignerStore,
  type SubtopicSummary,
} from '@/stores/designer'
import { parseAiTaskError, requestReferenceImageExtraction } from '@/services/aiOrchestrator'
import { requestWorkspacePresence } from '@/services/workspaceStorage'
import { normalizeTopicRouting, type TopicRouteTransition } from '@/utils/topicRouting'

type ReviewSubtopic = {
  name: string
  displayName: string
  brief: string
  miTechnique: string
  prompt: string
}

type ReviewTopic = {
  sessionName: string
  topicName: string
  displayName: string
  topicPrompt: string
  subtopics: ReviewSubtopic[]
}

type ReviewRoute = {
  topicName: string
  displayName: string
  transition: TopicRouteTransition
  nextTopics: string[]
  branchMenu: Array<{
    label: string
    targetTopic: string
    targetDisplayName: string
  }>
}

type RouteCanvasNode = ReviewRoute & {
  left: number
  top: number
  width: number
  height: number
  isEntry: boolean
  isActive: boolean
}

type RouteCanvasEdge = {
  id: string
  path: string
  transition: TopicRouteTransition
}

type RouteNodeOverride = {
  left: number
  top: number
}

type RouteNodeDragState = {
  topicName: string
  startClientX: number
  startClientY: number
  originLeft: number
  originTop: number
} | null

type RouteCanvasPanState = {
  startClientX: number
  startClientY: number
  originScrollLeft: number
  originScrollTop: number
} | null

type ReferenceImageItem = {
  id: string
  name: string
  dataUrl: string
  status: 'processing' | 'ready' | 'error'
  extractedText: string
  error: string
}

type ManualTopicEditorSubtopicDraft = {
  id: string
  name: string
  brief: string
  miTechnique: string
  prompt: string
}

const router = useRouter()
const designerStore = useDesignerStore()
const convertType = ref(ConvertType)

const {
  step,
  type,
  authoringMode,
  convertContent,
  newConvertContent,
  convertLoading,
  sessionTopics,
  api1Result,
  authoringContext,
  queryTopicStrucLoading,
  userName,
  userSessionReady,
  analyticsState,
} = storeToRefs(designerStore)

const {
  updateStep,
  convert2topic,
  updateAuthoringMode,
  updateAuthoringContext,
  prepareTopicGeneration,
  markNextConvertWorkspaceRestoreSkipped,
  goalOptions,
  restoreLastUserSession,
  switchUserSession,
  loadWorkspaceFromServer,
  saveWorkspaceToServer,
  updateTopicPrompt,
  updateSubtopicPrompt,
  updateTopicRoutingEntryTopic,
  updateTopicRoutingTransition,
  updateTopicRoutingNextTopics,
  updateTopicRoutingBranchLabel,
  initializeManualAuthoringPlan,
  upsertManualTopicPlan,
  deleteManualTopicPlan,
  regeneratePlanTopic,
  regeneratePlanSubtopic,
} = designerStore

const fileList = ref([])
const referenceImageInputRef = ref<HTMLInputElement | null>(null)
const referenceImagePasteRef = ref<HTMLTextAreaElement | null>(null)
const referenceImageItems = ref<ReferenceImageItem[]>([])
const topicRegenerateLoading = ref<Record<string, boolean>>({})
const subtopicRegenerateLoading = ref<Record<string, boolean>>({})
const routeCanvasScrollerRef = ref<HTMLElement | null>(null)
const routeNodeOverrides = ref<Record<string, RouteNodeOverride>>({})
const routeNodeDragState = ref<RouteNodeDragState>(null)
const routeCanvasPanState = ref<RouteCanvasPanState>(null)
const routeCanvasScale = ref(1)
const activeAuthorSection = ref(2)
const overviewModalOpen = ref(false)
const overviewFeatureIndex = ref(0)
const publicBasePath = import.meta.env.BASE_URL || '/'
const resolvePublicAsset = (path: string) => {
  if (/^(?:https?:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }
  const runtimeBasePath = typeof window === 'undefined'
    ? '/'
    : window.location.pathname.endsWith('/')
      ? window.location.pathname
      : `${window.location.pathname.replace(/\/[^/]*$/, '')}/`
  const candidateBase = publicBasePath && publicBasePath !== '/' ? publicBasePath : runtimeBasePath
  const base = candidateBase.endsWith('/') ? candidateBase : `${candidateBase}/`
  return `${base}${path.replace(/^\/+/, '')}`
}
const overviewFeatures = [
  {
    key: 'task',
    tour: 'import-overview-task',
    kicker: 'Overview',
    navTitle: 'Design task',
    title: 'You are designing a virtual health coach conversation.',
    description:
      'An ECA, or Embodied Conversational Agent, is a virtual person on screen that talks with users through scripted coach messages and patient response choices. In this project, the ECA acts like a virtual health coach.',
    descriptionHtml:
      'An <strong>ECA</strong>, or <strong>Embodied Conversational Agent</strong>, is a virtual person on screen. It talks with users through <strong>coach messages</strong> and <strong>patient response choices</strong>. In this project, the ECA works like a <strong>virtual health coach</strong>.',
    detail:
      'Your task is to design the conversation the ECA will follow: what topics it covers, what it says, what choices patients can select, and how the conversation branches based on those choices.',
    detailHtml:
      'Your job is to design the conversation the ECA will follow: <strong>what topics it covers</strong>, <strong>what it says</strong>, <strong>what choices patients can select</strong>, and <strong>where each choice leads next</strong>.',
    captionTitle: 'What dialogue design means here',
    caption:
      'This is not only writing text. You are shaping a patient-facing interaction, so you review structure, wording, safety, tone, counseling style, and all possible paths before the dialogue is used.',
    captionHtml:
      'This is not just writing text. You are shaping a <strong>patient-facing interaction</strong>, so you review <strong>structure</strong>, <strong>wording</strong>, <strong>safety</strong>, <strong>tone</strong>, <strong>counseling style</strong>, and <strong>all possible paths</strong> before the dialogue is used.',
    hasImage: false,
    image: '/intro/plan.png',
    alt: 'Health dialogue design overview screenshot',
  },
  {
    key: 'brief',
    tour: 'import-brief-preview',
    kicker: 'First screen',
    navTitle: 'Brief',
    title: 'Start with the brief.',
    description:
      'The first step asks for the workflow mode, dialogue goal, target patient context, and source material.',
    detail:
      'These inputs tell the system what kind of conversation to plan, who the patient is, and what information the dialogue should follow.',
    captionTitle: 'What you enter first',
    caption:
      'Choose AI-assisted or manual authoring, define the goal and audience, then add the material that should guide the plan.',
    hasImage: true,
    image: '/intro/add-resource.png',
    alt: 'Add source material screenshot',
  },
  {
    key: 'plan',
    tour: 'import-plan-preview',
    kicker: 'Plan',
    navTitle: 'Planner',
    title: 'Plan the structure',
    description: 'Organize what the patient conversation should cover before writing dialogue.',
    detail:
      'Review topics and subtopics first so the patient journey has the right scope, sequence, and counseling intent.',
    captionTitle: 'Topic structure',
    caption:
      'Use the plan to check topic order, subtopic coverage, and whether the conversation path makes sense before creating states.',
    hasImage: true,
    image: '/intro/plan.png',
    alt: 'Topic plan review screenshot',
  },
  {
    key: 'flow',
    tour: 'import-flow-preview',
    kicker: 'Canvas',
    navTitle: 'Flow',
    title: 'Design the flow',
    description: 'Connect coach messages, patient choices, and branches on the dialogue canvas.',
    detail:
      'Each state is a conversation step. Designers inspect wording, options, transitions, and possible patient paths.',
    captionTitle: 'State flow',
    caption:
      'The canvas turns the topic plan into states, patient options, and transitions that can be reviewed and edited.',
    hasImage: true,
    image: '/intro/flow.png',
    alt: 'Dialogue flow canvas screenshot',
  },
  {
    key: 'preview',
    tour: 'import-agent-preview',
    kicker: 'Preview',
    navTitle: 'Preview',
    title: 'Preview the experience',
    description: 'Use Agent Preview to test the patient experience before export.',
    detail:
      'Run the dialogue as the virtual coach to check pacing, tone, branch behavior, and whether the conversation feels safe and usable.',
    captionTitle: 'Patient experience test',
    caption:
      'Preview helps you feel the dialogue from the patient side before deciding it is ready.',
    hasImage: true,
    image: '/intro/agent-preview.png',
    alt: 'Agent preview screenshot',
  },
  {
    key: 'patient',
    tour: 'import-patient-facing',
    kicker: 'Final output',
    navTitle: 'Review',
    title: 'The finished dialogue faces real users.',
    description:
      'The exported conversation may be experienced by real patients or participants, so it needs careful review before use.',
    detail:
      'Go through all topics, messages, options, branches, and preview paths. Confirm that the dialogue is safe, understandable, and aligned with your counseling approach.',
    captionTitle: 'Review before export',
    caption:
      'The target conversation should support at least a 5 minute patient experience and should be tested in Agent Preview before export.',
    hasImage: true,
    image: '/intro/agent-preview.png',
    alt: 'Patient-facing agent preview screenshot',
  },
] as const
const activeOverviewFeature = computed(() => overviewFeatures[overviewFeatureIndex.value] ?? overviewFeatures[0])
type ImportTourMode = 'create' | 'plan'
type ImportTourStep = {
  selector: string
  title: string
  body: string
  note?: string
}
const importTourActive = ref(false)
const importTourMode = ref<ImportTourMode>('create')
const importTourStepIndex = ref(0)
const importTourTargetRect = ref<DOMRect | null>(null)
const createTourShown = ref(false)
const planTourShown = ref(false)
const planGuidePulseDismissed = ref(false)
let importAutoSaveTimer: number | null = null
let importPresenceTimer: number | null = null
type ImportTourTargetOptions = {
  scrollTarget?: boolean
}
const manualTopicEditor = ref<{
  visible: boolean
  mode: 'create' | 'edit'
  sessionName: string
  originalTopicName: string
  topicName: string
  topicPrompt: string
  subtopics: ManualTopicEditorSubtopicDraft[]
  error: string
}>({
  visible: false,
  mode: 'create',
  sessionName: '',
  originalTopicName: '',
  topicName: '',
  topicPrompt: '',
  subtopics: [],
  error: '',
})

const isManualAuthoringMode = computed(() => authoringMode.value === AuthoringMode.MANUAL)
const authorSectionProgress = computed(() => {
  if (isManualAuthoringMode.value) {
    return activeAuthorSection.value === 5 ? 100 : 50
  }
  return Math.max(25, Math.min(100, (activeAuthorSection.value - 1) * 25))
})
const reviewLoadingActive = computed(() => convertLoading.value || queryTopicStrucLoading.value)
const reviewLoadingPercent = computed(() => {
  if (queryTopicStrucLoading.value) {
    return 82
  }
  if (convertLoading.value) {
    return 46
  }
  return 0
})
const reviewLoadingTitle = computed(() =>
  queryTopicStrucLoading.value ? 'Preparing the dialogue editor...' : 'Generating the topic plan...',
)
const reviewLoadingDescription = computed(() =>
  queryTopicStrucLoading.value
    ? 'The system is turning the approved plan into editable dialogue steps, so you can preview and refine the ECA conversation.'
    : 'The system is reading your task, target user, and reference material, then building a clear outline for the conversation.',
)
const pasteShortcutLabel = computed(() => {
  if (typeof navigator === 'undefined') {
    return 'Ctrl+V or Cmd+V'
  }
  const platform = `${navigator.platform || ''} ${navigator.userAgent || ''}`.toLowerCase()
  return /mac|iphone|ipad|ipod/.test(platform) ? 'Cmd+V' : 'Ctrl+V'
})
const createImportTourSteps = computed<ImportTourStep[]>(() => {
  const steps: ImportTourStep[] = [
    {
    selector: '[data-tour="import-workflow-mode"]',
    title: 'Choose AI or manual workflow',
    body: isManualAuthoringMode.value
      ? 'Manual Authoring means no AI assistance. You create the topics, states, options, and transitions yourself.'
      : 'AI-Assisted can draft the initial plan from your brief and sources. You still review and approve the design.',
    },
  ]

  if (!isManualAuthoringMode.value) {
    steps.push({
    selector: '[data-tour="import-brief"]',
    title: 'Define the brief',
    body:
      'Set the goal and target patient context so the design matches the audience, risk level, and counseling intent.',
    })
    steps.push({
    selector: '[data-tour="import-sources"]',
    title: 'Add source material',
    body:
      'Add guidelines, notes, scripts, or other materials the dialogue should follow. Better sources make the plan easier to review.',
    })
  }

  steps.push({
    selector: '[data-tour="import-generate-plan"]',
    title: isManualAuthoringMode.value ? 'Optional planner' : 'Generate the topic plan',
    body: isManualAuthoringMode.value
      ? 'You can sketch topics and subtopics before the editor, or skip this step and build directly on the dialogue canvas.'
      : 'When the brief and sources are ready, create the plan. You will review the structure before generating the editable dialogue.',
  })

  return steps
})
const planImportTourSteps = computed<ImportTourStep[]>(() => {
  const steps: ImportTourStep[] = [
    {
      selector: '[data-tour="plan-topic-button"]',
      title: isManualAuthoringMode.value ? 'Planner topics' : 'Topics and subtopics',
      body: isManualAuthoringMode.value
        ? 'Each topic is a section of your outline. You can add or edit topics here, or skip this planner.'
        : 'Click each topic in the left sidebar so you review the full patient path, not just the first section.',
    },
    {
      selector: '[data-tour="plan-subtopic-button"]',
      title: 'Focus a subtopic',
      body:
        'Click a subtopic to jump to that part of the plan and inspect the matching design intent on the right.',
    },
    {
      selector: '[data-tour="plan-subtopic-detail"]',
      title: 'Subtopic design intent',
      body:
        'This card explains what this part of the conversation should accomplish and which counseling technique it should use.',
    },
    {
      selector: '[data-tour="plan-generate-dialogue"]',
      title: isManualAuthoringMode.value ? 'Open the dialogue editor' : 'Generate Dialogue',
      body: isManualAuthoringMode.value
        ? 'Open the editor when you are ready. You can do this with or without planner topics.'
        : 'After reviewing the plan, generate the editable dialogue. The next screen is where you inspect every state and test with Agent Preview.',
      note: isManualAuthoringMode.value
        ? 'The editor is where the actual dialogue states, options, and transitions are built.'
        : 'Do not move forward until the structure is safe, clear, and aligned with your counseling style.',
    },
  ]

  if (!isManualAuthoringMode.value) {
    steps.unshift({
      selector: '[data-tour="plan-ai-revise-input"]',
      title: 'Revise the plan with AI',
      body:
        'Use this input only when the overall plan needs changes. AI suggestions are not final; the dialogue designer still decides what is safe and appropriate.',
    })
    if (reviewRoutes.value.length) {
      steps.splice(1, 0, {
        selector: '[data-tour="plan-route-settings"]',
        title: 'Advanced route settings',
        body:
          'Use this only when you need to change the entry topic, topic order, ending, or branching between topics.',
      })
    }
  }

  return steps
})
const activeImportTourSteps = computed(() =>
  importTourMode.value === 'plan' ? planImportTourSteps.value : createImportTourSteps.value,
)
const currentImportTourStep = computed(
  () => activeImportTourSteps.value[importTourStepIndex.value] ?? activeImportTourSteps.value[0],
)
const importTourHighlightStyle = computed(() => {
  const rect = importTourTargetRect.value
  if (!rect) {
    return null
  }
  const padding = 8
  const margin = 8
  const left = Math.max(margin, rect.left - padding)
  const top = Math.max(margin, rect.top - padding)
  const maxWidth =
    typeof window === 'undefined' ? rect.width + padding * 2 : window.innerWidth - left - margin
  const maxHeight =
    typeof window === 'undefined' ? rect.height + padding * 2 : window.innerHeight - top - margin
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${Math.max(0, Math.min(rect.width + padding * 2, maxWidth))}px`,
    height: `${Math.max(0, Math.min(rect.height + padding * 2, maxHeight))}px`,
  }
})
const importTourCardStyle = computed(() => {
  const rect = importTourTargetRect.value
  const cardWidth = 360
  const cardHeight = 260
  const margin = 18
  if (!rect || typeof window === 'undefined') {
    return {
      left: `${margin}px`,
      top: '96px',
    }
  }

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const safeWidth = Math.min(cardWidth, Math.max(260, viewportWidth - margin * 2))
  const maxLeft = Math.max(margin, viewportWidth - safeWidth - margin)
  const maxTop = Math.max(margin, viewportHeight - cardHeight - margin)
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
  const spaces = {
    right: viewportWidth - rect.right - margin,
    left: rect.left - margin,
    bottom: viewportHeight - rect.bottom - margin,
    top: rect.top - margin,
  }

  let nextLeft = rect.right + 18
  let nextTop = rect.top

  if (spaces.right >= safeWidth + 18) {
    nextLeft = rect.right + 18
    nextTop = rect.top
  } else if (spaces.left >= safeWidth + 18) {
    nextLeft = rect.left - safeWidth - 18
    nextTop = rect.top
  } else if (spaces.bottom >= cardHeight + 18) {
    nextLeft = rect.left + rect.width / 2 - safeWidth / 2
    nextTop = rect.bottom + 18
  } else if (spaces.top >= cardHeight + 18) {
    nextLeft = rect.left + rect.width / 2 - safeWidth / 2
    nextTop = rect.top - cardHeight - 18
  } else {
    nextLeft = rect.left + rect.width / 2 - safeWidth / 2
    nextTop = margin
  }

  return {
    left: `${clamp(nextLeft, margin, maxLeft)}px`,
    top: `${clamp(nextTop, margin, maxTop)}px`,
    width: `${safeWidth}px`,
    maxHeight: `calc(100vh - ${margin * 2}px)`,
  }
})
const authoringModeOptions = [
  { label: 'AI-Assisted', value: AuthoringMode.AI },
  { label: 'Manual Authoring', value: AuthoringMode.MANUAL },
]

const goalValue = computed({
  get: () => authoringContext.value.goal,
  set: (value: AuthoringGoal) => updateAuthoringContext({ goal: value }),
})

const ageMinValue = computed<number | null>({
  get: () => authoringContext.value.ageMin,
  set: (value) => updateAuthoringContext({ ageMin: value }),
})

const ageMaxValue = computed<number | null>({
  get: () => authoringContext.value.ageMax,
  set: (value) => updateAuthoringContext({ ageMax: value }),
})

const genderValue = computed({
  get: () => authoringContext.value.gender,
  set: (value: string) => updateAuthoringContext({ gender: value }),
})

const personaValue = computed({
  get: () => authoringContext.value.persona,
  set: (value: string) => updateAuthoringContext({ persona: value }),
})

const userNameModalVisible = ref(false)
const userNameModalRequired = ref(false)
const pendingUserName = ref('')
const userNameError = ref('')

const userNameDisplay = computed(() => (userName.value || '').trim())
const dismissPlanGuidePulse = () => {
  planGuidePulseDismissed.value = true
}
const shouldPulsePlanGuide = computed(
  () =>
    step.value === 1 &&
    reviewTopics.value.length > 0 &&
    !planGuidePulseDismissed.value &&
    !importTourActive.value,
)

const openUserNameModal = (required = false) => {
  userNameModalRequired.value = required
  pendingUserName.value = required && !userSessionReady.value ? '' : userNameDisplay.value
  userNameError.value = ''
  userNameModalVisible.value = true
}

const resetImportUiState = () => {
  fileList.value = []
  referenceImageItems.value = []
  expandedTopicKeys.value = []
  activeSelection.value = {
    topicIndex: -1,
    subtopicIndex: -1,
  }
  subtopicRefs.clear()
}

const restoreServerWorkspaceState = async (options: { silent?: boolean } = {}) => {
  if (!userSessionReady.value || !userNameDisplay.value) {
    return false
  }

  try {
    const result = await loadWorkspaceFromServer()
    if (!result.ok || !result.found) {
      return false
    }
    if (!options.silent) {
      message.success(`Loaded server workspace for ${userNameDisplay.value}.`)
    }
    return true
  } catch (error) {
    console.error('Failed to restore server workspace', error)
    if (!options.silent) {
      message.error('Failed to restore workspace from server.')
    }
    return false
  }
}

const runImportAutoSave = async () => {
  if (!userSessionReady.value || !userNameDisplay.value) {
    return
  }

  try {
    await saveWorkspaceToServer({
      reason: 'auto-save',
      createSnapshot: false,
    })
  } catch (error) {
    console.error('Failed to auto-save authoring workspace to server', error)
  }
}

const handleUserNameSubmit = async () => {
  const trimmed = pendingUserName.value.trim()
  if (!trimmed.length) {
    userNameError.value = 'Please enter your name.'
    return
  }
  if (userSessionReady.value && userNameDisplay.value) {
    try {
      await saveWorkspaceToServer({
        reason: 'user-switch',
        createSnapshot: true,
      })
    } catch (error) {
      console.error('Failed to save workspace before switching user', error)
    }
  }
  const result = switchUserSession(trimmed)
  if (result.threadChanged) {
    resetImportUiState()
    const restoredFromServer = await restoreServerWorkspaceState({ silent: true })
    message.success(
      restoredFromServer || result.restored
        ? `Loaded workspace for ${result.userName}.`
        : `Started a new workspace for ${result.userName}.`,
    )
  }
  userNameModalVisible.value = false
}

const handleUserNameCancel = () => {
  if (userNameModalRequired.value) {
    return
  }
  userNameModalVisible.value = false
}

const handleGlobalUserNameModalRequest = () => {
  openUserNameModal()
}

const ensureUserName = () => {
  if (userSessionReady.value && userNameDisplay.value) {
    return true
  }
  openUserNameModal(true)
  message.info('Please set your user name to keep workspaces separate.')
  return false
}

const getCreateTourSection = (selector: string) => {
  if (selector.includes('workflow-mode')) return 2
  if (isManualAuthoringMode.value) return 5
  if (selector.includes('brief')) return 3
  if (selector.includes('sources')) return 4
  if (selector.includes('generate-plan')) return 5
  return 2
}

const openOverviewModal = () => {
  overviewFeatureIndex.value = 0
  overviewModalOpen.value = true
  createTourShown.value = true
}

const syncImportTourVisibleSection = () => {
  const step = currentImportTourStep.value
  if (!step || importTourMode.value !== 'create') {
    return
  }
  const nextSection = getCreateTourSection(step.selector)
  if (activeAuthorSection.value !== nextSection) {
    activeAuthorSection.value = nextSection
  }
  const featureIndex = overviewFeatures.findIndex((feature) => step.selector.includes(feature.tour))
  if (featureIndex >= 0 && overviewFeatureIndex.value !== featureIndex) {
    overviewFeatureIndex.value = featureIndex
  }
}

const updateImportTourTarget = async (options: ImportTourTargetOptions = {}) => {
  if (!importTourActive.value) {
    return
  }
  const { scrollTarget = true } = options
  await nextTick()
  syncImportTourVisibleSection()
  await nextTick()
  const selector = currentImportTourStep.value?.selector
  const target =
    (selector ? document.querySelector(selector) : null) ??
    document.querySelector(importTourMode.value === 'plan' ? '[data-tour="plan-review-overview"]' : '[data-tour="import-overview"]')
  if (scrollTarget && target && 'scrollIntoView' in target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    await new Promise((resolve) => window.setTimeout(resolve, 260))
  }
  importTourTargetRect.value = target?.getBoundingClientRect() ?? null
}

const updateImportTourTargetFromViewport = () => {
  if (importTourActive.value) {
    void updateImportTourTarget({ scrollTarget: false })
  }
}

const startImportTour = (mode: ImportTourMode) => {
  importTourMode.value = mode
  importTourStepIndex.value = 0
  importTourActive.value = true
  if (mode === 'create') {
    createTourShown.value = true
    activeAuthorSection.value = 2
  } else {
    planTourShown.value = true
  }
  void updateImportTourTarget()
}

const onStartPlanGuide = () => {
  dismissPlanGuidePulse()
  startImportTour('plan')
}

watch(isManualAuthoringMode, (manual) => {
  if (manual && (activeAuthorSection.value === 3 || activeAuthorSection.value === 4)) {
    activeAuthorSection.value = 5
  }
})

const endImportTour = () => {
  importTourActive.value = false
  importTourTargetRect.value = null
}

const nextImportTourStep = () => {
  importTourStepIndex.value = Math.min(importTourStepIndex.value + 1, activeImportTourSteps.value.length - 1)
  void updateImportTourTarget()
}

const previousImportTourStep = () => {
  importTourStepIndex.value = Math.max(importTourStepIndex.value - 1, 0)
  void updateImportTourTarget()
}

const maybeStartImportTour = () => {
  // Guides are opt-in from the Overview/Guide buttons. Do not interrupt normal authoring.
}

const goalSelectOptions = goalOptions.map((option) => ({
  label: option.label,
  value: option.value,
}))

onMounted(async () => {
  window.addEventListener('healthdial:open-user-name-modal', handleGlobalUserNameModalRequest)
  window.addEventListener('resize', updateImportTourTargetFromViewport)
  window.addEventListener('scroll', updateImportTourTargetFromViewport, true)

  if (!userSessionReady.value) {
    const restored = restoreLastUserSession()
    if (!restored) {
      nextTick(() => openUserNameModal(true))
      return
    }
  }
  await restoreServerWorkspaceState({ silent: true })

  if (typeof window !== 'undefined') {
    importAutoSaveTimer = window.setInterval(() => {
      void runImportAutoSave()
    }, 120000)
    importPresenceTimer = window.setInterval(() => {
      void sendImportPresenceHeartbeat()
    }, 20000)
  }
  void sendImportPresenceHeartbeat()
  nextTick(() => maybeStartImportTour())
})

onBeforeUnmount(() => {
  window.removeEventListener('healthdial:open-user-name-modal', handleGlobalUserNameModalRequest)
  window.removeEventListener('resize', updateImportTourTargetFromViewport)
  window.removeEventListener('scroll', updateImportTourTargetFromViewport, true)
  stopRouteNodeDragging()
  stopRouteCanvasPanning()
  if (importAutoSaveTimer !== null && typeof window !== 'undefined') {
    window.clearInterval(importAutoSaveTimer)
    importAutoSaveTimer = null
  }
  if (importPresenceTimer !== null && typeof window !== 'undefined') {
    window.clearInterval(importPresenceTimer)
    importPresenceTimer = null
  }
})

const expandedTopicKeys = ref<string[]>([])
const activeSelection = ref<{ topicIndex: number; subtopicIndex: number }>({
  topicIndex: -1,
  subtopicIndex: -1,
})

const subtopicRefs = new Map<string, Element>()

const getTopicKey = (topicIndex: number) => topicIndex.toString()
const getSubtopicKey = (topicIndex: number, subtopicIndex: number) => `${topicIndex}-${subtopicIndex}`
const getTopicRequestKey = (topic: Pick<ReviewTopic, 'sessionName' | 'topicName'>) =>
  `${topic.sessionName}::${topic.topicName}`
const getSubtopicRequestKey = (
  topic: Pick<ReviewTopic, 'sessionName' | 'topicName'>,
  subtopic: Pick<ReviewSubtopic, 'name'>,
) => `${getTopicRequestKey(topic)}::${subtopic.name}`

const DISPLAY_ACRONYMS = new Set(['api', 'eca', 'fsm', 'hpv', 'mi'])

const formatDisplayLabel = (value: string, fallback = 'Untitled') => {
  const normalized = String(value || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')

  if (!normalized.length) {
    return fallback
  }

  return normalized
    .split(' ')
    .filter((entry) => entry.length > 0)
    .map((word) => {
      const lower = word.toLowerCase()
      if (DISPLAY_ACRONYMS.has(lower)) {
        return lower.toUpperCase()
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

const setSubtopicRef = (key: string) => (el: any) => {
  const target = (el?.$el ?? el) as Element | null
  if (target) {
    subtopicRefs.set(key, target)
  } else {
    subtopicRefs.delete(key)
  }
}

const scrollToSubtopic = (key: string) => {
  nextTick(() => {
    const target = subtopicRefs.get(key)
    if (target && 'scrollIntoView' in target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

const topicDetailLookup = computed(() => {
  const lookup = new Map<string, Map<string, ReviewSubtopic>>()
  const allTopicsRecord = (api1Result.value?.all_topics ?? {}) as Record<string, Array<string | SubtopicSummary>>
  Object.entries(allTopicsRecord).forEach(([topicName, entries]) => {
    const topicKey = topicName.trim().toLowerCase()
    if (!topicKey) return
    const details = new Map<string, ReviewSubtopic>()
    entries.forEach((entry) => {
      if (!entry) return
      if (typeof entry === 'string') {
        const name = entry.trim()
        if (!name) return
        const nameKey = name.toLowerCase()
        if (!details.has(nameKey)) {
          details.set(nameKey, {
            name,
            displayName: formatDisplayLabel(name, 'Untitled Subtopic'),
            brief: '',
            miTechnique: '',
            prompt: '',
          })
        }
        return
      }
      const normalized = entry as SubtopicSummary
      const name = normalized.name?.trim() ?? ''
      if (!name) return
      details.set(name.toLowerCase(), {
        name,
        displayName: formatDisplayLabel(name, 'Untitled Subtopic'),
        brief: normalized.brief ?? '',
        miTechnique: normalized.miTechnique ?? '',
        prompt: normalized.prompt ?? '',
      })
    })
    if (details.size) {
      lookup.set(topicKey, details)
    }
  })
  return lookup
})
const reviewTopics = computed<ReviewTopic[]>(() => {
  const detailLookup = topicDetailLookup.value
  return sessionTopics.value.flatMap((session) =>
    session.topics.map((topic) => {
      const topicKey = topic.topicName.trim().toLowerCase()
      const subtopicDetails = topicKey ? detailLookup.get(topicKey) : undefined
      return {
        sessionName: session.sessionName,
        topicName: topic.topicName,
        displayName: formatDisplayLabel(topic.topicName, 'Untitled Topic'),
        topicPrompt: topic.topicPrompt ?? '',
        subtopics: (topic.list ?? []).map((subtopic) => {
          const normalizedName = subtopic.name?.trim() ?? ''
          const detail = normalizedName ? subtopicDetails?.get(normalizedName.toLowerCase()) : undefined
          const fallbackName = normalizedName || 'Untitled Subtopic'
          return {
            name: fallbackName,
            displayName: detail?.displayName ?? formatDisplayLabel(fallbackName, 'Untitled Subtopic'),
            brief: detail?.brief ?? subtopic.brief ?? '',
            miTechnique: detail?.miTechnique ?? subtopic.miTechnique ?? '',
            prompt: detail?.prompt ?? subtopic.prompt ?? '',
          }
        }),
      }
    }),
  )
})

const isTopicExpanded = (topicIndex: number) => {
  const topicKey = getTopicKey(topicIndex)
  return expandedTopicKeys.value.includes(topicKey)
}

const setActiveSelection = (topicIndex: number, subtopicIndex: number) => {
  activeSelection.value = { topicIndex, subtopicIndex }
}

const resolveDefaultSubtopicIndex = (topicIndex: number) => {
  const subtopics = reviewTopics.value[topicIndex]?.subtopics ?? []
  return subtopics.length ? 0 : -1
}

const ensureTopicExpanded = (topicIndex: number) => {
  const topicKey = getTopicKey(topicIndex)
  if (!expandedTopicKeys.value.includes(topicKey)) {
    expandedTopicKeys.value = [...expandedTopicKeys.value, topicKey]
  }
}

const toggleTopicExpansion = (topicIndex: number, expand?: boolean) => {
  const topicKey = getTopicKey(topicIndex)
  const isExpanded = expandedTopicKeys.value.includes(topicKey)
  const shouldExpand = expand ?? !isExpanded
  if (shouldExpand && !isExpanded) {
    expandedTopicKeys.value = [...expandedTopicKeys.value, topicKey]
  } else if (!shouldExpand && isExpanded) {
    expandedTopicKeys.value = expandedTopicKeys.value.filter((key) => key !== topicKey)
  }
}

const isActiveTopic = (topicIndex: number) => {
  return activeSelection.value.topicIndex === topicIndex
}

const isActiveSubtopic = (topicIndex: number, subtopicIndex: number) => {
  return isActiveTopic(topicIndex) && activeSelection.value.subtopicIndex === subtopicIndex
}

const currentTopic = computed(() => {
  const { topicIndex } = activeSelection.value
  if (topicIndex < 0) return null
  return reviewTopics.value[topicIndex] ?? null
})

const currentSubtopics = computed(() => currentTopic.value?.subtopics ?? [])

watch(
  () => [
    userSessionReady.value,
    userNameDisplay.value,
    step.value,
    activeSelection.value.topicIndex,
    activeSelection.value.subtopicIndex,
    authoringMode.value,
  ],
  () => {
    void sendImportPresenceHeartbeat()
  },
)

watch(
  () => userNameDisplay.value,
  () => {
    planGuidePulseDismissed.value = false
  },
  { immediate: true },
)

watch(
  () => [step.value, reviewTopics.value.length],
  () => {
    nextTick(() => maybeStartImportTour())
  },
)

watch(
  () => [
    importTourActive.value,
    importTourStepIndex.value,
    importTourMode.value,
    activeAuthorSection.value,
    overviewFeatureIndex.value,
    activeSelection.value.topicIndex,
    activeSelection.value.subtopicIndex,
  ],
  () => {
    if (importTourActive.value) {
      void updateImportTourTarget()
    }
  },
)

const routeTransitionOptions = [
  { label: 'Go directly to the next topic', value: 'direct' as TopicRouteTransition },
  { label: 'Offer a topic choice branch', value: 'branch' as TopicRouteTransition },
  { label: 'End the full conversation here', value: 'end' as TopicRouteTransition },
]

const reviewTopicOptions = computed(() =>
  reviewTopics.value.map((topic) => ({
    label: topic.displayName,
    value: topic.topicName,
  })),
)

const getTopicDisplayNameByName = (topicName: string) =>
  reviewTopics.value.find((topic) => topic.topicName === topicName)?.displayName ??
  formatDisplayLabel(topicName, 'Untitled Topic')

const routingPlan = computed(() =>
  normalizeTopicRouting(
    api1Result.value?.topic_routing ?? null,
    reviewTopics.value.map((topic) => topic.topicName),
  ),
)

const reviewRoutes = computed<ReviewRoute[]>(() =>
  routingPlan.value.routes.map((route) => ({
    topicName: route.topicName,
    displayName: getTopicDisplayNameByName(route.topicName),
    transition: route.transition,
    nextTopics: [...route.nextTopics],
    branchMenu: route.branchMenu.map((choice) => ({
      ...choice,
      targetDisplayName: getTopicDisplayNameByName(choice.targetTopic),
    })),
  })),
)

const totalSubtopicCount = computed(() =>
  reviewTopics.value.reduce((total, topic) => total + topic.subtopics.length, 0),
)

const branchRouteCount = computed(() =>
  reviewRoutes.value.filter((route) => route.transition === 'branch').length,
)

const routeIssueMessages = computed(() => {
  const issues: string[] = []
  reviewRoutes.value.forEach((route) => {
    if (route.transition === 'direct' && !route.nextTopics.length) {
      issues.push(`${route.displayName} is set to continue, but no next topic is selected.`)
    }
    if (route.transition === 'branch' && route.nextTopics.length < 2) {
      issues.push(`${route.displayName} is a branch, but it needs at least two branch topics.`)
    }
    if (route.transition === 'branch') {
      route.branchMenu.forEach((choice) => {
        if (!choice.label.trim()) {
          issues.push(`${route.displayName} has an empty branch label for ${choice.targetDisplayName}.`)
        }
      })
    }
  })
  return issues
})

const canOpenDialogueEditor = computed(() =>
  isManualAuthoringMode.value ? true : sessionTopics.value.length > 0,
)

const buildImportPresencePayload = () => {
  const activeTopic = currentTopic.value
  const activeSubtopic =
    activeSelection.value.subtopicIndex >= 0
      ? currentSubtopics.value[activeSelection.value.subtopicIndex]?.name ?? null
      : null

  return {
    userName: userNameDisplay.value,
    workspaceId: 'default',
    authoringMode: authoringMode.value,
    step: step.value,
    currentView: step.value === 0 ? 'import-author' : 'import-review',
    currentRoute: '/import',
    currentTopic: activeTopic?.topicName ?? null,
    currentSubtopic: activeSubtopic,
    sessionId: analyticsState.value?.sessionId ?? null,
    planTopicCount: reviewTopics.value.length || sessionTopics.value.length,
    graphTopicCount: 0,
    stateCount: 0,
    optionCount: 0,
    jumpCount: 0,
    analyticsEventCount: analyticsState.value?.events?.length ?? null,
    lastActivityAt:
      typeof analyticsState.value?.lastActivityAt === 'number'
        ? new Date(analyticsState.value.lastActivityAt).toISOString()
        : null,
  }
}

const sendImportPresenceHeartbeat = async () => {
  if (!userSessionReady.value || !userNameDisplay.value) {
    return
  }

  try {
    await requestWorkspacePresence(buildImportPresencePayload())
  } catch (error) {
    console.warn('Failed to update import workspace presence', error)
  }
}

const ROUTE_CANVAS_NODE_WIDTH = 324
const ROUTE_CANVAS_COLUMN_GAP = 64
const ROUTE_CANVAS_PADDING_X = 28
const ROUTE_CANVAS_PADDING_Y = 24
const ROUTE_CANVAS_NODE_TOP = 74
const ROUTE_CANVAS_BRANCH_LANE_TOP = 26
const ROUTE_CANVAS_BRANCH_LANE_GAP = 18
const ROUTE_CANVAS_MIN_TOP = 56
const ROUTE_CANVAS_MIN_SCALE = 0.7
const ROUTE_CANVAS_MAX_SCALE = 1.8

const getRouteNodeHeight = (route: ReviewRoute) => {
  const estimateLines = (text: string, charsPerLine: number) =>
    Math.max(1, Math.ceil(text.trim().length / charsPerLine))
  const summaryLines = estimateLines(describeRouteCompact(route), 36)
  const titleLines = estimateLines(route.displayName, 18)
  const summaryHeight = summaryLines * 14
  const titleHeight = titleLines * 18

  if (route.transition === 'branch') {
    return Math.max(250, 150 + titleHeight + summaryHeight + route.branchMenu.length * 54)
  }
  if (route.transition === 'direct') {
    return Math.max(214, 148 + titleHeight + summaryHeight)
  }
  return Math.max(198, 136 + titleHeight + summaryHeight)
}

const findTopicIndexByName = (topicName: string) =>
  reviewTopics.value.findIndex((topic) => topic.topicName === topicName)

const clampRouteNodeOverride = (left: number, top: number) => ({
  left: Math.max(ROUTE_CANVAS_PADDING_X, Math.round(left)),
  top: Math.max(ROUTE_CANVAS_MIN_TOP, Math.round(top)),
})

const clampRouteCanvasScale = (value: number) =>
  Math.min(ROUTE_CANVAS_MAX_SCALE, Math.max(ROUTE_CANVAS_MIN_SCALE, Number(value) || 1))

const routeCanvasScaleValue = computed(() => clampRouteCanvasScale(routeCanvasScale.value))
const routeCanvasScalePercent = computed(() => `${Math.round(clampRouteCanvasScale(routeCanvasScale.value) * 100)}%`)

const isRouteCanvasPanning = computed(() => Boolean(routeCanvasPanState.value))

const onSelectRouteTopic = (topicName: string) => {
  const topicIndex = findTopicIndexByName(topicName)
  if (topicIndex < 0) {
    return
  }
  ensureTopicExpanded(topicIndex)
  const subtopicIndex = resolveDefaultSubtopicIndex(topicIndex)
  setActiveSelection(topicIndex, subtopicIndex)
  if (subtopicIndex >= 0) {
    scrollToSubtopic(getSubtopicKey(topicIndex, subtopicIndex))
  }
}

const routeCanvasBaseLayout = computed(() => {
  const routes = reviewRoutes.value
  if (!routes.length) {
    return {
      width: 0,
      height: 0,
      nodes: [] as RouteCanvasNode[],
      edges: [] as RouteCanvasEdge[],
    }
  }

  const originalTopicNames = reviewTopics.value.map((topic) => topic.topicName)
  const topicOrder = new Map(originalTopicNames.map((topicName, index) => [topicName, index] as const))

  const nodes = routes.map<RouteCanvasNode>((route) => {
    const column = topicOrder.get(route.topicName) ?? 0
    const height = getRouteNodeHeight(route)
    const defaultLeft =
      ROUTE_CANVAS_PADDING_X + column * (ROUTE_CANVAS_NODE_WIDTH + ROUTE_CANVAS_COLUMN_GAP)
    const defaultTop = ROUTE_CANVAS_NODE_TOP
    const override = routeNodeOverrides.value[route.topicName]
    const position = override
      ? clampRouteNodeOverride(override.left, override.top)
      : { left: defaultLeft, top: defaultTop }
    return {
      ...route,
      left: position.left,
      top: position.top,
      width: ROUTE_CANVAS_NODE_WIDTH,
      height,
      isEntry: route.topicName === routingPlan.value.entryTopic,
      isActive: currentTopic.value?.topicName === route.topicName,
    }
  })

  const nodeMap = new Map(nodes.map((node) => [node.topicName, node] as const))
  const edges: RouteCanvasEdge[] = []
  let laneIndex = 0

  nodes.forEach((node) => {
    node.nextTopics.forEach((targetTopic, index) => {
      const targetNode = nodeMap.get(targetTopic)
      if (!targetNode) {
        return
      }

      const startX = node.left + node.width
      const branchOffset = node.nextTopics.length > 1 ? (index - (node.nextTopics.length - 1) / 2) * 12 : 0
      const startY = node.top + node.height / 2 + branchOffset
      const endX = targetNode.left
      const endY = targetNode.top + targetNode.height / 2
      const sourceOrder = topicOrder.get(node.topicName) ?? 0
      const targetOrder = topicOrder.get(targetTopic) ?? 0
      const isAdjacent = Math.abs(targetOrder - sourceOrder) <= 1
      const shouldUseLane = node.transition === 'branch' || !isAdjacent
      const laneY = ROUTE_CANVAS_BRANCH_LANE_TOP + laneIndex * ROUTE_CANVAS_BRANCH_LANE_GAP
      laneIndex += shouldUseLane ? 1 : 0

      edges.push({
        id: `${node.topicName}__${targetTopic}`,
        transition: node.transition,
        path: shouldUseLane
          ? `M ${startX} ${startY} L ${startX + 16} ${startY} L ${startX + 16} ${laneY} L ${endX - 16} ${laneY} L ${endX - 16} ${endY} L ${endX} ${endY}`
          : `M ${startX} ${startY} L ${endX} ${endY}`,
      })
    })
  })

  const width =
    Math.max(
      ROUTE_CANVAS_PADDING_X * 2 +
        nodes.length * ROUTE_CANVAS_NODE_WIDTH +
        Math.max(0, nodes.length - 1) * ROUTE_CANVAS_COLUMN_GAP,
      nodes.reduce((furthest, node) => Math.max(furthest, node.left + node.width), 0) +
        ROUTE_CANVAS_PADDING_X,
    )
  const height = Math.max(
    ROUTE_CANVAS_NODE_TOP + nodes.reduce((highest, node) => Math.max(highest, node.height), 0) + ROUTE_CANVAS_PADDING_Y + 28,
    nodes.reduce((furthest, node) => Math.max(furthest, node.top + node.height), 0) +
      ROUTE_CANVAS_PADDING_Y +
      32,
  )

  return {
    width,
    height,
    nodes,
    edges,
  }
})

const routeCanvasViewport = computed(() => ({
  width: routeCanvasBaseLayout.value.width * routeCanvasScaleValue.value,
  height: routeCanvasBaseLayout.value.height * routeCanvasScaleValue.value,
}))

const getRoutingTargetOptions = (topicName: string) =>
  reviewTopicOptions.value.filter((option) => option.value !== topicName)

const describeRoute = (route: ReviewRoute) => {
  if (route.transition === 'end' || !route.nextTopics.length) {
    return 'This topic ends the full conversation.'
  }

  if (route.transition === 'direct') {
    return `After this topic, continue directly into ${getTopicDisplayNameByName(route.nextTopics[0])}.`
  }

  const labels = route.nextTopics.map((topicName) => getTopicDisplayNameByName(topicName))
  return `After this topic, offer a branch so the user can choose among ${labels.join(', ')}.`
}

const describeRouteCompact = (route: ReviewRoute) => {
  if (route.transition === 'end' || !route.nextTopics.length) {
    return 'Ends the conversation.'
  }

  if (route.transition === 'direct') {
    return `Then go to ${getTopicDisplayNameByName(route.nextTopics[0])}.`
  }

  const labels = route.nextTopics.map((topicName) => getTopicDisplayNameByName(topicName))
  return `Then offer a choice: ${labels.join(', ')}.`
}

const onUpdateEntryTopic = (value: string) => {
  if (!value) {
    return
  }
  updateTopicRoutingEntryTopic(value)
}

const onUpdateRouteTransition = (topicName: string, value: TopicRouteTransition) => {
  updateTopicRoutingTransition(topicName, value)
}

const onUpdateDirectNextTopic = (topicName: string, value: string | undefined) => {
  updateTopicRoutingNextTopics(topicName, value ? [value] : [])
}

const onUpdateBranchNextTopics = (topicName: string, values: string[]) => {
  updateTopicRoutingNextTopics(topicName, values)
}

const onUpdateBranchLabel = (topicName: string, targetTopic: string, value: string) => {
  updateTopicRoutingBranchLabel(topicName, targetTopic, value)
}

const onClearRouteTargets = (topicName: string) => {
  updateTopicRoutingNextTopics(topicName, [])
}

const onRouteNodePointerMove = (event: PointerEvent) => {
  const dragState = routeNodeDragState.value
  if (!dragState) {
    return
  }

  const scale = routeCanvasScaleValue.value
  const nextLeft = dragState.originLeft + (event.clientX - dragState.startClientX) / scale
  const nextTop = dragState.originTop + (event.clientY - dragState.startClientY) / scale

  routeNodeOverrides.value = {
    ...routeNodeOverrides.value,
    [dragState.topicName]: clampRouteNodeOverride(nextLeft, nextTop),
  }
}

const stopRouteNodeDragging = () => {
  routeNodeDragState.value = null
  window.removeEventListener('pointermove', onRouteNodePointerMove)
  window.removeEventListener('pointerup', stopRouteNodeDragging)
}

const onRouteNodePointerDown = (topicName: string, event: PointerEvent) => {
  const node = routeCanvasBaseLayout.value.nodes.find((entry) => entry.topicName === topicName)
  if (!node) {
    return
  }

  routeNodeDragState.value = {
    topicName,
    startClientX: event.clientX,
    startClientY: event.clientY,
    originLeft: node.left,
    originTop: node.top,
  }

  window.addEventListener('pointermove', onRouteNodePointerMove)
  window.addEventListener('pointerup', stopRouteNodeDragging)
}

const stopRouteCanvasPanning = () => {
  routeCanvasPanState.value = null
  window.removeEventListener('pointermove', onRouteCanvasPointerMove)
  window.removeEventListener('pointerup', stopRouteCanvasPanning)
}

const onRouteCanvasPointerMove = (event: PointerEvent) => {
  const panState = routeCanvasPanState.value
  const scroller = routeCanvasScrollerRef.value
  if (!panState || !scroller) {
    return
  }

  scroller.scrollLeft = panState.originScrollLeft - (event.clientX - panState.startClientX)
  scroller.scrollTop = panState.originScrollTop - (event.clientY - panState.startClientY)
}

const onRouteCanvasPointerDown = (event: PointerEvent) => {
  const scroller = routeCanvasScrollerRef.value
  const target = event.target as HTMLElement | null
  if (!scroller || !target) {
    return
  }

  if (target.closest('.route-canvas-node')) {
    return
  }

  routeCanvasPanState.value = {
    startClientX: event.clientX,
    startClientY: event.clientY,
    originScrollLeft: scroller.scrollLeft,
    originScrollTop: scroller.scrollTop,
  }

  window.addEventListener('pointermove', onRouteCanvasPointerMove)
  window.addEventListener('pointerup', stopRouteCanvasPanning)
}

const setRouteCanvasScale = (nextScale: number) => {
  routeCanvasScale.value = clampRouteCanvasScale(nextScale)
}

const adjustRouteCanvasScale = (delta: number) => {
  setRouteCanvasScale(routeCanvasScale.value + delta)
}

const resetRouteCanvasView = () => {
  routeCanvasScale.value = 1
  routeNodeOverrides.value = {}
  nextTick(() => {
    const scroller = routeCanvasScrollerRef.value
    if (scroller) {
      scroller.scrollLeft = 0
      scroller.scrollTop = 0
    }
  })
}

const onRouteCanvasWheel = (event: WheelEvent) => {
  if (!event.ctrlKey && !event.metaKey) {
    return
  }

  event.preventDefault()
  const delta = event.deltaY < 0 ? 0.08 : -0.08
  adjustRouteCanvasScale(delta)
}

const onUpdateTopicPrompt = (topicIndex: number, value: string) => {
  const topic = reviewTopics.value[topicIndex]
  if (!topic) {
    return
  }
  updateTopicPrompt(topic.sessionName, topic.topicName, value)
}

const onUpdateSubtopicPrompt = (topicIndex: number, subtopicIndex: number, value: string) => {
  const topic = reviewTopics.value[topicIndex]
  const subtopic = topic?.subtopics?.[subtopicIndex]
  if (!topic || !subtopic) {
    return
  }
  updateSubtopicPrompt(topic.sessionName, topic.topicName, subtopic.name, value)
}

const handleTopicPromptInput = (topicIndex: number, value: string) => {
  onUpdateTopicPrompt(topicIndex, value)
}

const handleSubtopicPromptInput = (topicIndex: number, subtopicIndex: number, value: string) => {
  onUpdateSubtopicPrompt(topicIndex, subtopicIndex, value)
}

const appendRevisionText = (currentValue: string, addition: string) => {
  const trimmed = currentValue.trim()
  return trimmed.length ? `${trimmed}\n${addition}` : addition
}

const applyGlobalRevisionTemplate = (template: 'beginner' | 'patient' | 'shorter') => {
  const templates = {
    beginner:
      'Make this topic plan easier for a first-time user to understand. Use a warmer opening, separate complex ideas into smaller topics, and make the final next step explicit.',
    patient:
      'Revise the plan to be more patient-centered. Acknowledge uncertainty, use plain language, include practical barriers, and keep motivational interviewing techniques supportive rather than directive.',
    shorter:
      'Simplify and shorten the topic plan. Remove overlapping topics, keep only essential subtopics, and preserve a clear beginning, middle, and final action step.',
  }
  newConvertContent.value = appendRevisionText(newConvertContent.value, templates[template])
}

const applyTopicRevisionTemplate = (template: 'clearer' | 'empathetic' | 'actionable') => {
  if (!currentTopic.value) {
    return
  }
  const templates = {
    clearer:
      'Clarify this topic purpose. Make the subtopics easier to scan and remove overlap with nearby topics.',
    empathetic:
      'Make this topic more empathetic and patient-centered. Add space for common worries, hesitation, or confusion.',
    actionable:
      'Make this topic more actionable. End with a clear user decision, response, or next step.',
  }
  const nextValue = appendRevisionText(currentTopic.value.topicPrompt, templates[template])
  onUpdateTopicPrompt(activeSelection.value.topicIndex, nextValue)
}

const applySubtopicRevisionTemplate = (subtopicIndex: number, template: 'plain' | 'barrier') => {
  const subtopic = currentSubtopics.value[subtopicIndex]
  if (!subtopic) {
    return
  }
  const templates = {
    plain:
      'Use simpler wording for a first-time patient. Avoid medical jargon and make the counseling goal easy to understand.',
    barrier:
      'Address common patient concerns or practical barriers, then connect the response to a supportive next step.',
  }
  const nextValue = appendRevisionText(subtopic.prompt, templates[template])
  onUpdateSubtopicPrompt(activeSelection.value.topicIndex, subtopicIndex, nextValue)
}

const isTopicRegenerating = (topic: ReviewTopic) =>
  Boolean(topicRegenerateLoading.value[getTopicRequestKey(topic)])

const isSubtopicRegenerating = (topic: ReviewTopic, subtopic: ReviewSubtopic) =>
  Boolean(subtopicRegenerateLoading.value[getSubtopicRequestKey(topic, subtopic)])

const onRegenerateTopic = async (topic: ReviewTopic) => {
  const revisionNote = (topic.topicPrompt || '').trim()
  if (!revisionNote.length) {
    message.warning('Add topic revision notes before regenerating this topic.')
    return
  }

  const loadingKey = getTopicRequestKey(topic)
  topicRegenerateLoading.value = {
    ...topicRegenerateLoading.value,
    [loadingKey]: true,
  }

  try {
    await regeneratePlanTopic({
      sessionName: topic.sessionName,
      topicName: topic.topicName,
      revisionNote,
      baseMentorDirections: newConvertContent.value,
    })
    message.success(`Regenerated ${topic.displayName}.`)
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Topic regeneration failed.'
    message.error(detail)
  } finally {
    topicRegenerateLoading.value = {
      ...topicRegenerateLoading.value,
      [loadingKey]: false,
    }
  }
}

const onRegenerateSubtopic = async (topic: ReviewTopic, subtopic: ReviewSubtopic) => {
  const revisionNote = (subtopic.prompt || '').trim()
  if (!revisionNote.length) {
    message.warning('Add subtopic revision notes before regenerating this subtopic.')
    return
  }

  const loadingKey = getSubtopicRequestKey(topic, subtopic)
  subtopicRegenerateLoading.value = {
    ...subtopicRegenerateLoading.value,
    [loadingKey]: true,
  }

  try {
    await regeneratePlanSubtopic({
      sessionName: topic.sessionName,
      topicName: topic.topicName,
      subtopicName: subtopic.name,
      revisionNote,
      baseMentorDirections: newConvertContent.value,
    })
    message.success(`Regenerated ${subtopic.displayName}.`)
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Subtopic regeneration failed.'
    message.error(detail)
  } finally {
    subtopicRegenerateLoading.value = {
      ...subtopicRegenerateLoading.value,
      [loadingKey]: false,
    }
  }
}

const onToggleTopic = (topicIndex: number) => {
  const expanded = isTopicExpanded(topicIndex)
  toggleTopicExpansion(topicIndex, !expanded)
  if (!expanded) {
    const subtopicIndex = resolveDefaultSubtopicIndex(topicIndex)
    setActiveSelection(topicIndex, subtopicIndex)
    if (subtopicIndex >= 0) {
      scrollToSubtopic(getSubtopicKey(topicIndex, subtopicIndex))
    }
  }
}

const onSelectSubtopic = (topicIndex: number, subtopicIndex: number) => {
  ensureTopicExpanded(topicIndex)
  setActiveSelection(topicIndex, subtopicIndex)
  scrollToSubtopic(getSubtopicKey(topicIndex, subtopicIndex))
}

const buildManualEditorSubtopicDraft = (subtopic?: Partial<ReviewSubtopic>): ManualTopicEditorSubtopicDraft => ({
  id: crypto.randomUUID(),
  name: subtopic?.name ?? '',
  brief: subtopic?.brief ?? '',
  miTechnique: subtopic?.miTechnique ?? '',
  prompt: subtopic?.prompt ?? '',
})

const resetManualTopicEditor = () => {
  manualTopicEditor.value = {
    visible: false,
    mode: 'create',
    sessionName: '',
    originalTopicName: '',
    topicName: '',
    topicPrompt: '',
    subtopics: [],
    error: '',
  }
}

const addManualEditorSubtopic = () => {
  manualTopicEditor.value = {
    ...manualTopicEditor.value,
    subtopics: [...manualTopicEditor.value.subtopics, buildManualEditorSubtopicDraft()],
  }
}

const removeManualEditorSubtopic = (subtopicId: string) => {
  manualTopicEditor.value = {
    ...manualTopicEditor.value,
    subtopics: manualTopicEditor.value.subtopics.filter((entry) => entry.id !== subtopicId),
  }
}

const openManualTopicEditorForCreate = () => {
  const sessionName = currentTopic.value?.sessionName || sessionTopics.value[0]?.sessionName || 'manual_authoring'
  manualTopicEditor.value = {
    visible: true,
    mode: 'create',
    sessionName,
    originalTopicName: '',
    topicName: '',
    topicPrompt: '',
    subtopics: [buildManualEditorSubtopicDraft()],
    error: '',
  }
}

const openManualTopicEditorForEdit = (topic: ReviewTopic) => {
  manualTopicEditor.value = {
    visible: true,
    mode: 'edit',
    sessionName: topic.sessionName,
    originalTopicName: topic.topicName,
    topicName: topic.topicName,
    topicPrompt: topic.topicPrompt ?? '',
    subtopics:
      topic.subtopics.length > 0
        ? topic.subtopics.map((subtopic) => buildManualEditorSubtopicDraft(subtopic))
        : [buildManualEditorSubtopicDraft()],
    error: '',
  }
}

const saveManualTopicEditor = () => {
  const topicName = manualTopicEditor.value.topicName.trim()
  const subtopics = manualTopicEditor.value.subtopics
    .map((entry) => ({
      name: entry.name.trim(),
      brief: entry.brief.trim(),
      miTechnique: entry.miTechnique.trim(),
      prompt: entry.prompt.trim(),
    }))
    .filter((entry) => entry.name.length > 0)

  if (!topicName.length) {
    manualTopicEditor.value = {
      ...manualTopicEditor.value,
      error: 'Topic name is required.',
    }
    return
  }

  const duplicateTopic = reviewTopics.value.find(
    (topic) =>
      topic.topicName.trim().toLowerCase() === topicName.toLowerCase() &&
      topic.topicName.trim().toLowerCase() !== manualTopicEditor.value.originalTopicName.trim().toLowerCase(),
  )

  if (duplicateTopic) {
    manualTopicEditor.value = {
      ...manualTopicEditor.value,
      error: 'Topic name already exists.',
    }
    return
  }

  if (!subtopics.length) {
    manualTopicEditor.value = {
      ...manualTopicEditor.value,
      error: 'Add at least one subtopic.',
    }
    return
  }

  try {
    upsertManualTopicPlan({
      sessionName: manualTopicEditor.value.sessionName,
      topicName,
      originalTopicName: manualTopicEditor.value.mode === 'edit' ? manualTopicEditor.value.originalTopicName : '',
      topicPrompt: manualTopicEditor.value.topicPrompt,
      subtopics,
    })

    const nextTopicIndex = reviewTopics.value.findIndex((topic) => topic.topicName === topicName)
    if (nextTopicIndex >= 0) {
      ensureTopicExpanded(nextTopicIndex)
      setActiveSelection(nextTopicIndex, reviewTopics.value[nextTopicIndex].subtopics.length ? 0 : -1)
    }
    resetManualTopicEditor()
  } catch (error) {
    manualTopicEditor.value = {
      ...manualTopicEditor.value,
      error:
        error instanceof Error ? error.message : 'Unable to save this topic right now.',
    }
  }
}

const deleteCurrentManualTopic = () => {
  if (!currentTopic.value) {
    return
  }

  deleteManualTopicPlan(currentTopic.value.topicName, {
    sessionName: currentTopic.value.sessionName,
  })
}

watch(
  reviewTopics,
  (topics) => {
    const validTopicKeys = new Set(topics.map((topic) => topic.topicName))
    routeNodeOverrides.value = Object.fromEntries(
      Object.entries(routeNodeOverrides.value).filter(([topicName]) => validTopicKeys.has(topicName)),
    )

    if (!topics.length) {
      expandedTopicKeys.value = []
      activeSelection.value = { topicIndex: -1, subtopicIndex: -1 }
      return
    }
    const topicIndex = Math.min(Math.max(activeSelection.value.topicIndex, 0), topics.length - 1)
    const subtopicIndex =
      topicIndex >= 0
        ? Math.min(
            Math.max(activeSelection.value.subtopicIndex, 0),
            (topics[topicIndex].subtopics?.length ?? 0) - 1,
          )
        : -1

    activeSelection.value = {
      topicIndex,
      subtopicIndex,
    }

    if (topicIndex >= 0) {
      expandedTopicKeys.value = [getTopicKey(topicIndex)]
    } else {
      expandedTopicKeys.value = []
    }
  },
  { immediate: true, deep: true },
)

const onConvertToTopic = () => {
  if (!ensureUserName()) {
    return
  }
  if (isManualAuthoringMode.value) {
    initializeManualAuthoringPlan()
    updateStep(1)
    return
  }
  if (!convertContent.value.trim()) {
    message.warning('Please provide content before generating a plan.')
    return
  }
  updateStep(1)
  convert2topic(convertContent.value, newConvertContent.value)
}

const onBack = () => {
  updateStep(0)
}

const onRegenerate = () => {
  if (!ensureUserName()) {
    return
  }
  if (isManualAuthoringMode.value) {
    return
  }
  if (!convertContent.value.trim()) {
    message.warning('Please provide content before regenerating.')
    return
  }
  convert2topic(convertContent.value, newConvertContent.value)
}

const onGenerateDialogue = () => {
  if (!ensureUserName()) {
    return
  }
  if (isManualAuthoringMode.value) {
    initializeManualAuthoringPlan()
    markNextConvertWorkspaceRestoreSkipped()
    router.push('/convert')
    return
  }
  if (!canOpenDialogueEditor.value) {
    message.warning('Generate a topic plan before creating a dialogue.')
    return
  }
  updateAuthoringMode(AuthoringMode.AI)
  prepareTopicGeneration(newConvertContent.value)
  markNextConvertWorkspaceRestoreSkipped()
  router.push('/convert')
}

const onChangeStep = (current: number) => {
  updateStep(current)
}

const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024

const buildReferenceImageName = (file: File) => {
  const raw = String(file.name || '').trim()
  if (raw.length) {
    return raw
  }
  return `reference-image-${Date.now()}.png`
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error(`Failed to read ${buildReferenceImageName(file)}.`))
    reader.readAsDataURL(file)
  })

const appendReferenceImageText = (item: ReferenceImageItem, content: string) => {
  const trimmed = content.trim()
  if (!trimmed.length) {
    return
  }
  const block = `[Image Reference: ${item.name}]\n${trimmed}`
  const current = convertContent.value.trim()
  convertContent.value = current.length ? `${current}\n\n${block}` : block
  type.value = ConvertType.TEXT
}

const updateReferenceImageItem = (id: string, patch: Partial<ReferenceImageItem>) => {
  referenceImageItems.value = referenceImageItems.value.map((item) =>
    item.id === id ? { ...item, ...patch } : item,
  )
}

const extractReferenceImage = async (item: ReferenceImageItem) => {
  try {
    const response = await requestReferenceImageExtraction({
      imageDataUrl: item.dataUrl,
      fileName: item.name,
      authoringContext: authoringContext.value,
    })
    const extracted = String(response.content || '').trim()
    if (!extracted.length) {
      throw new Error('No usable text was extracted from this image.')
    }
    appendReferenceImageText(item, extracted)
    updateReferenceImageItem(item.id, {
      status: 'ready',
      extractedText: extracted,
      error: '',
    })
    message.success(`Added extracted text from ${item.name}.`)
  } catch (error) {
    const parsed = parseAiTaskError(error, 'Image extraction failed.')
    updateReferenceImageItem(item.id, {
      status: 'error',
      extractedText: '',
      error: parsed.detail || parsed.message,
    })
    message.error(parsed.detail || parsed.message)
  }
}

const addReferenceImages = async (files: File[]) => {
  const validFiles = files.filter((file) => file.type.startsWith('image/'))
  if (!validFiles.length) {
    message.warning('Please paste or upload an image file.')
    return
  }

  for (const file of validFiles) {
    if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
      message.warning(`${buildReferenceImageName(file)} is too large. Please use an image under 8 MB.`)
      continue
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      const item: ReferenceImageItem = {
        id: crypto.randomUUID(),
        name: buildReferenceImageName(file),
        dataUrl,
        status: 'processing',
        extractedText: '',
        error: '',
      }
      referenceImageItems.value = [...referenceImageItems.value, item]
      await extractReferenceImage(item)
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : typeof error === 'string' ? error : 'Image import failed.'
      message.error(detail)
    }
  }
}

const isImageFile = (file: File) => {
  if (file.type.startsWith('image/')) {
    return true
  }
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif|tiff?)$/i.test(file.name)
}

const getClipboardImageFiles = (event: ClipboardEvent) => {
  const clipboard = event.clipboardData
  if (!clipboard) {
    return []
  }

  const fromItems = Array.from(clipboard.items ?? [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file))

  const fromFiles = Array.from(clipboard.files ?? []).filter(isImageFile)
  const seen = new Set<string>()
  return [...fromItems, ...fromFiles].filter((file) => {
    const key = `${file.name}:${file.size}:${file.type}:${file.lastModified}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

const onReferenceTextPaste = (event: ClipboardEvent) => {
  const files = getClipboardImageFiles(event)
  if (!files.length) {
    return
  }
  event.preventDefault()
  void addReferenceImages(files)
}

const onReferenceImagePaste = (event: ClipboardEvent) => {
  const files = getClipboardImageFiles(event)
  if (!files.length) {
    message.info('No image was found in the clipboard. Try taking a screenshot again or use Upload Image.')
    return
  }
  event.preventDefault()
  void addReferenceImages(files)
}

const focusReferenceImagePasteTarget = () => {
  referenceImagePasteRef.value?.focus()
}

const openReferenceImagePicker = () => {
  referenceImageInputRef.value?.click()
}

const onReferenceImageInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  const files = Array.from(target?.files ?? [])
  if (target) {
    target.value = ''
  }
  if (!files.length) {
    return
  }
  void addReferenceImages(files)
}

const retryReferenceImage = (id: string) => {
  const item = referenceImageItems.value.find((entry) => entry.id === id)
  if (!item) {
    return
  }
  updateReferenceImageItem(id, {
    status: 'processing',
    error: '',
  })
  void extractReferenceImage(item)
}

const removeReferenceImage = (id: string) => {
  referenceImageItems.value = referenceImageItems.value.filter((item) => item.id !== id)
}

const onCustomRequest: UploadProps['customRequest'] = (options) => {
  setTimeout(() => {
    options.onSuccess?.(options.file)
  })
}

const handleChange = (info: UploadChangeParam) => {
  const status = info.file.status
  if (status === 'done') {
    message.success(`${info.file.name} uploaded.`)
    const reader = new FileReader()
    reader.readAsText(info.file.originFileObj!, 'UTF-8')
    reader.onload = function () {
      convertContent.value = String(this.result ?? '')
    }
  } else if (status === 'error') {
    message.error(`${info.file.name} upload failed.`)
  }
}
</script>

<style lang="scss" scoped>
.import-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
  padding-top: 8px;
  font-size: 16px;
  font-family:
    'Avenir Next',
    'Segoe UI',
    'PingFang SC',
    'Hiragino Sans GB',
    'Noto Sans SC',
    sans-serif;
  background:
    radial-gradient(circle at 8% 4%, rgba(15, 118, 110, 0.1), transparent 28%),
    radial-gradient(circle at 92% 0%, rgba(14, 165, 165, 0.08), transparent 24%);

  .step-wrapper {
    width: min(860px, calc(100% - 64px));
    margin: 0 auto;
    padding: 4px 0 2px;

    ::v-deep(.ant-steps-item-description) {
      white-space: nowrap;
      color: #6f858a;
      font-size: 13px;
    }

    ::v-deep(.ant-steps-item-title) {
      color: #173d42;
      font-size: 16px;
      font-weight: 800;
    }

    ::v-deep(.ant-steps-item-process .ant-steps-item-icon) {
      background: #0f766e;
      border-color: #0f766e;
    }

    ::v-deep(.ant-steps-item-finish .ant-steps-item-icon) {
      border-color: #0f766e;
    }

    ::v-deep(.ant-steps-item-finish .ant-steps-icon),
    ::v-deep(.ant-steps-item-finish .ant-steps-item-title::after) {
      color: #0f766e;
      background-color: #0f766e;
    }
  }

  ::v-deep(.ant-btn) {
    font-size: 15px;
  }
}

.steps-content {
  width: min(2070px, calc(100% - 48px));
  min-height: calc(100vh - 80px - $layout-header-height - 32px);
  height: auto;
  margin: 0 auto;
  padding: 0 24px 24px;

  & > .ant-card {
    min-height: calc(100vh - 80px - $layout-header-height - 56px);
    height: auto;
    border: 1px solid rgba(198, 219, 221, 0.9);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 16px 40px rgba(41, 84, 92, 0.08);
  }
}

.step-author {
  ::v-deep(.ant-card-body) {
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-height: calc(100vh - 80px - $layout-header-height - 88px);
    height: auto;
  }

  .workflow-guide-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .workflow-guide-header .ant-btn {
    flex: 0 0 auto;
    min-width: 92px;
  }

  .system-intro {
    display: grid;
    gap: 16px;
    padding: 22px;
    border: 1px solid #cfe8e6;
    border-radius: 18px;
    background:
      radial-gradient(circle at top right, rgba(217, 249, 240, 0.72), transparent 34%),
      linear-gradient(135deg, #ffffff 0%, #f7fbfa 100%);
  }

  .intro-slide-status {
    justify-self: start;
    padding: 5px 10px;
    border-radius: 999px;
    background: #e6f4f1;
    color: #0f766e;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .system-intro-kicker {
    color: #0f766e;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .system-intro h1 {
    margin: 0;
    color: #12343b;
    font-size: 28px;
    line-height: 1.2;
    font-weight: 850;
  }

  .system-intro p {
    margin: 0;
    max-width: 1020px;
    color: #526d73;
    font-size: 15px;
    line-height: 1.6;
  }

  .intro-slide {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(360px, 0.9fr);
    gap: 24px;
    align-items: center;
    min-height: 280px;
  }

  .intro-slide-copy {
    display: grid;
    gap: 10px;
  }

  .intro-illustration {
    min-height: 250px;
    display: grid;
    place-items: center;
    padding: 22px;
    border: 1px solid #dbeafe;
    border-radius: 18px;
    background:
      radial-gradient(circle at top left, rgba(204, 251, 241, 0.82), transparent 35%),
      linear-gradient(135deg, #ffffff 0%, #f0f8f7 100%);
  }

  .coach-screen {
    display: grid;
    gap: 14px;
    width: min(320px, 100%);
    padding: 18px;
    border: 2px solid #bae6fd;
    border-radius: 22px;
    background: #ffffff;
    box-shadow: 0 18px 34px rgba(8, 145, 178, 0.12);
  }

  .coach-avatar {
    display: grid;
    place-items: center;
    width: 82px;
    height: 82px;
    border-radius: 50%;
    background: #0891b2;
    color: #ffffff;
    font-weight: 900;
  }

  .coach-bubble,
  .participant-bubble,
  .dialogue-card {
    padding: 12px 14px;
    border-radius: 14px;
    background: #f8fafc;
    color: #334155;
    font-size: 14px;
    line-height: 1.45;
  }

  .participant-bubble {
    justify-self: end;
    max-width: 240px;
    margin-top: 12px;
    border: 1px solid #bae6fd;
    background: #ecfeff;
    color: #164e63;
    font-weight: 700;
  }

  .device-frame {
    display: grid;
    justify-items: center;
    gap: 14px;
    width: min(260px, 100%);
    padding: 22px;
    border: 2px solid #bae6fd;
    border-radius: 26px;
    background: #ffffff;
    box-shadow: 0 18px 34px rgba(8, 145, 178, 0.12);
  }

  .simple-face {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 28px;
    width: 112px;
    height: 112px;
    border-radius: 50%;
    background: #ccfbf1;
  }

  .simple-face span {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #0f766e;
  }

  .device-line {
    width: 58%;
    height: 10px;
    border-radius: 999px;
    background: #e2e8f0;
  }

  .device-line.wide {
    width: 78%;
  }

  .device-pill {
    padding: 7px 12px;
    border-radius: 999px;
    background: #0891b2;
    color: #ffffff;
    font-size: 13px;
    font-weight: 900;
  }

  .dialogue-illustration {
    justify-items: center;
  }

  .dialogue-card {
    width: min(300px, 100%);
    border: 1px solid #dbeafe;
    background: #ffffff;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
    font-weight: 800;
  }

  .dialogue-card.left {
    justify-self: start;
  }

  .dialogue-card.right {
    justify-self: end;
    background: #ecfeff;
  }

  .dialogue-connector {
    width: 2px;
    height: 26px;
    background: #67e8f9;
  }

  .plan-illustration {
    align-content: center;
    gap: 12px;
  }

  .plan-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: min(360px, 100%);
    padding: 13px 14px;
    border: 1px solid #dbeafe;
    border-radius: 14px;
    background: #ffffff;
    color: #334155;
    font-weight: 800;
  }

  .plan-row span {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #e0f2fe;
    color: #0369a1;
    font-size: 13px;
    font-weight: 900;
  }

  .plan-row.active {
    border-color: #67e8f9;
    background: #ecfeff;
  }

  .convert-illustration {
    padding: 14px;
  }

  .convert-screen-mock {
    display: grid;
    gap: 10px;
    width: 100%;
    min-height: 238px;
    border: 1px solid #cfe0f2;
    border-radius: 18px;
    background: #edf4fb;
    overflow: hidden;
    box-shadow: 0 16px 34px rgba(15, 45, 82, 0.1);
  }

  .convert-toolbar-mock {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
    padding: 10px;
    border-bottom: 1px solid #d7e4f2;
    background: #ffffff;
  }

  .mock-button {
    display: inline-grid;
    place-items: center;
    min-height: 28px;
    padding: 0 10px;
    border: 1px solid #d7e3f2;
    border-radius: 10px;
    background: #ffffff;
    color: #17324d;
    font-size: 11px;
    font-weight: 900;
    white-space: nowrap;
  }

  .mock-button.primary {
    border-color: #1967d2;
    background: #1967d2;
    color: #ffffff;
  }

  .mock-button.dark {
    border-color: #0d3559;
    background: #0d3559;
    color: #ffffff;
  }

  .convert-workspace-mock {
    display: grid;
    grid-template-columns: minmax(120px, 0.45fr) minmax(180px, 1fr);
    min-height: 180px;
  }

  .convert-sidebar-mock {
    display: grid;
    align-content: start;
    gap: 8px;
    padding: 12px;
    border-right: 1px solid #cbd5e1;
    background: #ffffff;
  }

  .convert-panel-title {
    color: #0f172a;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .convert-chip {
    padding: 9px 10px;
    border-radius: 12px;
    background: #f8fafc;
    color: #334155;
    font-size: 13px;
    font-weight: 800;
  }

  .convert-chip.active {
    background: #ecfeff;
    color: #0e7490;
  }

  .convert-canvas-mock {
    display: grid;
    justify-items: center;
    align-content: center;
    padding: 16px;
    background:
      linear-gradient(90deg, rgba(77, 130, 214, 0.06) 1px, transparent 1px),
      linear-gradient(rgba(77, 130, 214, 0.06) 1px, transparent 1px),
      #f8fbff;
    background-size: 20px 20px, 20px 20px, 100% 100%;
  }

  .state-node {
    width: min(250px, 100%);
    padding: 10px 12px;
    border: 1px solid #dbeafe;
    border-radius: 14px;
    background: #ffffff;
    color: #0f172a;
    text-align: center;
    font-size: 13px;
    font-weight: 900;
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.07);
  }

  .user-node {
    justify-self: end;
    background: #ecfeff;
    color: #0e7490;
  }

  .state-line {
    width: 2px;
    height: 20px;
    background: #67e8f9;
  }

  .agent-panel-illustration {
    padding: 16px;
  }

  .agent-panel-mock {
    display: grid;
    gap: 12px;
    width: min(520px, 100%);
    padding: 14px;
    border: 1px solid #cfe0f2;
    border-radius: 18px;
    background: #ffffff;
    box-shadow: 0 16px 34px rgba(15, 45, 82, 0.1);
  }

  .agent-panel-top,
  .agent-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .agent-panel-top {
    color: #0f172a;
    font-size: 13px;
    font-weight: 900;
  }

  .agent-pills {
    display: flex;
    gap: 6px;
  }

  .agent-pills span {
    padding: 4px 9px;
    border: 1px solid #dbeafe;
    border-radius: 999px;
    color: #475569;
    font-size: 12px;
    font-weight: 800;
  }

  .agent-pills span.active {
    background: #0891b2;
    color: #ffffff;
    border-color: #0891b2;
  }

  .agent-stage {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    gap: 16px;
    align-items: center;
    min-height: 150px;
    padding: 16px;
    border-radius: 16px;
    background:
      radial-gradient(circle at top left, rgba(204, 251, 241, 0.9), transparent 38%),
      linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
  }

  .agent-person {
    display: grid;
    justify-items: center;
    gap: 0;
  }

  .agent-head {
    width: 58px;
    height: 58px;
    border-radius: 50%;
    background: #0e7490;
    box-shadow: inset 16px 0 0 rgba(255, 255, 255, 0.18);
  }

  .agent-body {
    width: 92px;
    height: 72px;
    border-radius: 36px 36px 16px 16px;
    background: #38bdf8;
  }

  .agent-speech {
    padding: 14px 16px;
    border: 1px solid #dbeafe;
    border-radius: 16px;
    background: #ffffff;
    color: #334155;
    font-size: 14px;
    line-height: 1.45;
    font-weight: 800;
  }

  .agent-controls {
    justify-content: flex-end;
  }

  .system-overview {
    display: grid;
    gap: 18px;
    padding: 22px;
    border: 1px solid #cfe8e6;
    border-radius: 18px;
    background: linear-gradient(135deg, #ffffff 0%, #f7fbfa 100%);
  }

  .system-overview-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.7fr);
    gap: 24px;
    align-items: start;
  }

  .system-overview-hero h1 {
    margin: 0;
    color: #12343b;
    font-size: 30px;
    line-height: 1.16;
    font-weight: 850;
  }

  .system-overview-hero p {
    margin: 12px 0 0;
    max-width: 980px;
    color: #526d73;
    font-size: 16px;
    line-height: 1.6;
  }

  .system-overview-summary {
    display: grid;
    gap: 10px;
    padding: 14px;
    border: 1px solid #d6e8e5;
    border-radius: 14px;
    background: #ffffff;
  }

  .system-overview-summary div {
    display: grid;
    gap: 3px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #f6faf9;
  }

  .system-overview-summary strong {
    color: #0f766e;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .system-overview-summary span {
    color: #334a50;
    font-size: 14px;
    line-height: 1.4;
    font-weight: 700;
  }

  .system-overview-flow {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }

  .system-overview-feature {
    display: grid;
    gap: 14px;
  }

  .system-feature-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .system-feature-tab {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 10px 12px;
    border: 1px solid #d6e8e5;
    border-radius: 10px;
    background: #ffffff;
    color: #314b52;
    text-align: left;
    cursor: pointer;
  }

  .system-feature-tab span {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: #eaf4f3;
    color: #0f766e;
    font-size: 13px;
    font-weight: 900;
  }

  .system-feature-tab strong {
    font-size: 15px;
    line-height: 1.25;
  }

  .system-feature-tab.active {
    border-color: #13a7b8;
    background: #eafafa;
    box-shadow: 0 10px 24px rgba(19, 167, 184, 0.12);
  }

  .system-feature-tab.active span {
    background: #0891b2;
    color: #ffffff;
  }

  .system-overview-card {
    display: grid;
    gap: 14px;
    align-content: start;
    padding: 14px;
    border: 1px solid #d6e8e5;
    border-radius: 14px;
    background: #ffffff;
  }

  .system-overview-card.feature-card {
    grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
    align-items: stretch;
    min-height: 520px;
  }

  .feature-card-copy {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 10px;
    padding: 8px 8px 8px 4px;
  }

  .system-overview-card h2 {
    margin: 0;
    color: #12343b;
    font-size: 24px;
    line-height: 1.25;
    font-weight: 850;
  }

  .system-overview-card p {
    margin: 6px 0 0;
    color: #526d73;
    font-size: 16px;
    line-height: 1.65;
  }

  .system-card-visual {
    min-height: 168px;
    border: 1px solid #e1ecee;
    border-radius: 12px;
    background: #f8fbfb;
    overflow: hidden;
  }

  .plan-visual {
    display: grid;
    align-content: center;
    gap: 8px;
    padding: 14px;
  }

  .mini-topic,
  .mini-subtopic {
    padding: 8px 10px;
    border-radius: 8px;
    color: #334a50;
    font-size: 12px;
    font-weight: 800;
  }

  .mini-topic {
    border-left: 3px solid #9fbfc4;
    background: #ffffff;
  }

  .mini-topic.active {
    border-left-color: #0f766e;
    background: #eaf4f3;
  }

  .mini-subtopic {
    margin-left: 18px;
    background: #f1f6f7;
  }

  .canvas-visual {
    display: grid;
    justify-items: center;
    align-content: center;
    padding: 16px;
    background:
      linear-gradient(90deg, rgba(15, 118, 110, 0.05) 1px, transparent 1px),
      linear-gradient(rgba(15, 118, 110, 0.05) 1px, transparent 1px),
      #f8fbfb;
    background-size: 18px 18px, 18px 18px, 100% 100%;
  }

  .screenshot-visual {
    display: flex;
    align-items: stretch;
    justify-content: center;
    background: #eef5f6;
  }

  .screenshot-visual img {
    width: 100%;
    height: 100%;
    min-height: 168px;
    object-fit: cover;
    object-position: center;
    display: block;
  }

  .screenshot-visual.large img {
    min-height: 488px;
    object-fit: contain;
    background: #eef5f6;
  }

  .mini-node {
    width: min(190px, 100%);
    padding: 10px 12px;
    border: 1px solid #d9c2a5;
    border-radius: 10px;
    background: #fff7ef;
    color: #2f3f45;
    text-align: center;
    font-size: 12px;
    font-weight: 850;
  }

  .mini-node.choice {
    border-color: #9fc6f5;
    background: #eaf4ff;
  }

  .mini-edge {
    width: 2px;
    height: 20px;
    background: #2f80ed;
  }

  .mini-edge.branch {
    transform: rotate(-28deg);
  }

  .preview-visual {
    position: relative;
    display: grid;
    grid-template-columns: 0.82fr 1fr;
    gap: 12px;
    align-items: center;
    padding: 16px;
    background: linear-gradient(180deg, #edf7f5 0%, #ffffff 100%);
  }

  .mini-agent {
    width: 92px;
    height: 124px;
    justify-self: center;
    border-radius: 46px 46px 24px 24px;
    background:
      radial-gradient(circle at 38px 28px, #7b4b35 0 22px, transparent 23px),
      linear-gradient(180deg, #f2bdd9 0%, #e897bf 100%);
    box-shadow: inset 18px 0 0 rgba(255, 255, 255, 0.18);
  }

  .mini-choice-list {
    display: grid;
    gap: 7px;
  }

  .mini-choice-list span {
    padding: 8px 10px;
    border-radius: 7px;
    background: #ffffff;
    color: #334a50;
    font-size: 12px;
    font-weight: 750;
    box-shadow: 0 1px 0 rgba(15, 23, 42, 0.08);
  }

  .convert-action-row {
    padding: 10px 12px;
    border-radius: 999px;
    background: #0891b2;
    color: #ffffff;
    text-align: center;
    font-size: 13px;
    font-weight: 900;
  }

  .system-intro-actions {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 12px;
    margin-top: 8px;
  }

  .intro-slide-dots {
    display: flex;
    justify-content: center;
    gap: 8px;
  }

  .intro-slide-dots button {
    width: 10px;
    height: 10px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: #cbd5e1;
    cursor: pointer;
  }

  .intro-slide-dots button.active {
    width: 28px;
    border-radius: 999px;
    background: #0891b2;
  }

  .author-workflow-guide {
    display: grid;
    gap: 16px;
    padding: 20px 22px;
    border: 1px solid #c8e7e0;
    border-radius: 20px;
    background:
      radial-gradient(circle at top left, rgba(236, 254, 255, 0.88), transparent 32%),
      linear-gradient(135deg, #ffffff 0%, #f7fcfb 100%);
    box-shadow: 0 14px 30px rgba(15, 118, 110, 0.08);
  }

  .workflow-guide-header {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: flex-start;
  }

  .workflow-guide-header .ant-btn {
    flex: 0 0 auto;
    min-width: 92px;
  }

  .workflow-progress {
    margin: -4px 0 0;
  }

  .workflow-eyebrow,
  .section-kicker {
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #0f766e;
  }

  .workflow-title {
    margin: 0;
    max-width: 980px;
    font-size: 24px;
    line-height: 1.2;
    font-weight: 850;
    color: #12343b;
  }

  .workflow-mode-card {
    min-width: 340px;
    display: grid;
    gap: 8px;
    padding: 14px 16px;
    border: 1px solid #bae6fd;
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
  }

  .mode-helper,
  .section-helper,
  .control-helper {
    margin: 0;
    color: #64748b;
    font-size: 14px;
    line-height: 1.45;
  }

  .workflow-steps {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .workflow-step {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 10px;
    align-items: start;
    padding: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: #ffffff;
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 0.18s ease,
      background-color 0.18s ease,
      box-shadow 0.18s ease,
      transform 0.18s ease;
  }

  .workflow-step:hover {
    border-color: #67e8f9;
    box-shadow: 0 8px 18px rgba(8, 145, 178, 0.08);
    transform: translateY(-1px);
  }

  .workflow-step.active {
    border-color: #67e8f9;
    background: #ecfeff;
  }

  .workflow-step.completed {
    border-color: #bbf7d0;
    background: #f7fef9;
  }

  .workflow-step-number {
    display: inline-grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #0891b2;
    color: #ffffff;
    font-weight: 900;
  }

  .workflow-step strong {
    display: block;
    color: #0f172a;
    font-size: 15px;
  }

  .workflow-step small {
    display: block;
    margin-top: 2px;
    color: #64748b;
    font-size: 13px;
    line-height: 1.4;
  }

  .workflow-mode-panel,
  .review-start-panel {
    display: grid;
    gap: 18px;
    padding: 18px 20px;
    border: 1px solid #bae6fd;
    border-radius: 18px;
    background:
      radial-gradient(circle at top left, rgba(236, 254, 255, 0.82), transparent 34%),
      linear-gradient(180deg, #ffffff 0%, #f8feff 100%);
    box-shadow: 0 10px 24px rgba(8, 145, 178, 0.05);
  }

  .mode-choice-layout {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 18px;
    flex-wrap: wrap;
  }

  .authoring-panel {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 18px 20px;
    border: 1px solid #dbeafe;
    border-radius: 18px;
    background:
      radial-gradient(circle at top left, rgba(239, 246, 255, 0.78), transparent 34%),
      linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    box-shadow: 0 10px 24px rgba(31, 79, 191, 0.05);
  }

  .section-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }

  .authoring-panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
  }

  .authoring-panel-title {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 0.01em;
    color: #102544;
  }

  .authoring-panel-caption {
    margin: 0;
    max-width: 980px;
    font-size: 15px;
    line-height: 1.65;
    color: #53657f;
  }

  .authoring-mode-switch {
    min-width: 280px;
    display: grid;
    gap: 8px;
    padding: 14px 16px;
    border: 1px solid rgba(162, 186, 228, 0.66);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.84);
    box-shadow: 0 8px 18px rgba(31, 79, 191, 0.08);
  }

  .authoring-mode-label {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #607089;
  }

  .manual-authoring-guide {
    display: grid;
    gap: 6px;
    padding: 14px 16px;
    border: 1px dashed #c9d7eb;
    border-radius: 14px;
    background: #f8fbff;
  }

  .manual-authoring-guide-title {
    font-size: 16px;
    font-weight: 800;
    color: #153b7a;
  }

  .manual-authoring-guide-copy {
    font-size: 15px;
    line-height: 1.65;
    color: #53657f;
  }

  .authoring-form {
    .task-form-sections {
      display: grid;
      gap: 16px;
    }

    .task-form-section {
      display: grid;
      gap: 12px;
      padding: 14px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.78);
    }

    .goal-section {
      border-color: #bfdbfe;
      background: #f8fbff;
    }

    .target-user-section {
      border-color: #bae6fd;
      background: #f8feff;
    }

    .form-section-header {
      display: grid;
      gap: 4px;
    }

    .form-section-header h3 {
      margin: 0;
      color: #0f172a;
      font-size: 18px;
      font-weight: 800;
    }

    .form-section-header p,
    .field-help {
      margin: 0;
      color: #64748b;
      font-size: 14px;
      line-height: 1.45;
    }

    .target-user-grid {
      display: grid;
      grid-template-columns: minmax(180px, 0.55fr) minmax(220px, 0.75fr) minmax(0, 1.7fr);
      gap: 16px 20px;
    }

    .persona-row {
      grid-column: auto;
    }

    ::v-deep(.ant-form-item-label > label) {
      font-size: 15px;
      font-weight: 600;
    }

    ::v-deep(.ant-form-item) {
      margin-bottom: 0;
    }

    ::v-deep(.ant-input),
    ::v-deep(.ant-input-number),
    ::v-deep(.ant-select-selector),
    ::v-deep(.ant-input-password) {
      font-size: 15px;
    }

    @media (max-width: 1100px) {
      .target-user-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .persona-row {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 768px) {
      .target-user-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  }

  .knowledge-panel {
    display: grid;
    gap: 18px;
    padding: 18px 20px 20px;
    border: 1px solid #d1fae5;
    border-radius: 20px;
    background:
      radial-gradient(circle at top left, rgba(220, 252, 231, 0.72), transparent 34%),
      linear-gradient(180deg, #ffffff 0%, #f7fdf9 100%);
    box-shadow: 0 10px 24px rgba(22, 101, 52, 0.05);
  }

  .knowledge-panel-header {
    display: grid;
    gap: 6px;
  }

  .knowledge-panel-title {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 0.01em;
    color: #11233f;
  }

  .knowledge-panel-caption {
    margin: 0;
    max-width: 1040px;
    font-size: 16px;
    line-height: 1.65;
    color: #4f5f75;
  }

  .convert-type-section {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .convert-type-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 12px;

      .section-title {
        font-size: 18px;
        font-weight: 700;
        color: #11233f;
      }
    }

    .input-mode-control {
      display: grid;
      gap: 6px;
      justify-items: end;
    }

    .input-area {
      width: 100%;

      ::v-deep(.ant-input) {
        font-size: 17px;
      }

      ::v-deep(.ant-upload) {
        padding: 32px;
        font-size: 17px;
      }

      ::v-deep(.ant-input),
      ::v-deep(.ant-upload-wrapper) {
        border-radius: 14px;
      }
    }
  }

  .reference-image-section {
    display: grid;
    gap: 16px;
    padding: 14px 16px 16px;
    border: 1px dashed #bae6fd;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.76);
  }

  .reference-image-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .reference-image-caption {
    margin: 4px 0 0;
    max-width: 980px;
    font-size: 15px;
    line-height: 1.6;
    color: #4f5f75;
  }

  .reference-image-paste-zone {
    position: relative;
    display: grid;
    gap: 8px;
    padding: 14px 16px;
    border: 1px dashed #9bb7eb;
    border-radius: 16px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(239, 245, 255, 0.95) 100%);
    cursor: pointer;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.2s ease;

    &:hover,
    &:focus {
      border-color: #5f7fc2;
      box-shadow: 0 10px 24px rgba(31, 79, 191, 0.1);
      transform: translateY(-1px);
      outline: none;
    }
  }

  .reference-image-paste-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: none;
    padding: 0;
    margin: 0;
    opacity: 0;
    resize: none;
    background: transparent;
    color: transparent;
    caret-color: transparent;
    cursor: pointer;
  }

  .reference-image-paste-title {
    position: relative;
    z-index: 1;
    font-size: 16px;
    font-weight: 700;
    color: #11233f;
    pointer-events: none;
  }

  .reference-image-paste-hint {
    position: relative;
    z-index: 1;
    font-size: 15px;
    line-height: 1.6;
    color: #607089;
    pointer-events: none;
  }

  .reference-image-input {
    display: none;
  }

  .reference-image-list {
    display: grid;
    gap: 14px;
  }

  .reference-image-item {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr);
    gap: 16px;
    padding: 14px;
    border: 1px solid #d8e6fb;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.92);

    &.processing {
      border-color: #b7caf0;
    }

    &.error {
      border-color: #f1b7b7;
      background: #fff8f8;
    }
  }

  .reference-image-preview {
    width: 100%;
    height: 110px;
    object-fit: cover;
    border-radius: 12px;
    border: 1px solid #d5dfee;
    background: #f8fbff;
  }

  .reference-image-content {
    min-width: 0;
    display: grid;
    gap: 8px;
  }

  .reference-image-name {
    font-size: 17px;
    font-weight: 700;
    color: #11233f;
    word-break: break-word;
  }

  .reference-image-status {
    font-size: 14px;
    font-weight: 600;
    color: #4f5f75;

    &.error {
      color: #b42318;
    }

    &.success {
      color: #156f4b;
    }
  }

  .reference-image-snippet {
    max-height: 132px;
    overflow: auto;
    padding: 10px 12px;
    border-radius: 12px;
    background: #f6f9ff;
    font-size: 14px;
    line-height: 1.55;
    color: #334155;
    white-space: pre-wrap;
  }

  .reference-image-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .author-footer {
    margin-top: auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 12px 0 0;
  }

  .author-footer-copy {
    max-width: 720px;
    color: #475569;
    font-size: 15px;
    line-height: 1.5;
  }

  .review-guide-actions {
    display: flex;
    justify-content: flex-end;
    margin-bottom: -6px;
  }

  :deep(.guide-attention-pulse.ant-btn) {
    position: relative;
    border-color: #1677ff;
    background: #1677ff;
    color: #ffffff;
    box-shadow: 0 0 0 0 rgba(22, 119, 255, 0.42);
    animation: import-guide-attention-pulse 1s ease-in-out infinite;
  }

  :deep(.guide-attention-pulse.ant-btn::after) {
    position: absolute;
    inset: -7px;
    border: 2px solid rgba(22, 119, 255, 0.45);
    border-radius: 10px;
    content: '';
    animation: import-guide-attention-ring 1s ease-in-out infinite;
  }

  .import-tour-overlay {
    position: fixed;
    inset: 0;
    z-index: 3000;
    pointer-events: none;
  }

  .import-tour-highlight {
    position: fixed;
    z-index: 3001;
    border: 3px solid #0f766e;
    border-radius: 14px;
    box-shadow:
      0 0 0 9999px rgba(8, 24, 28, 0.58),
      0 14px 34px rgba(15, 118, 110, 0.28);
    background: rgba(255, 255, 255, 0.04);
    pointer-events: none;
    transition:
      left 0.18s ease,
      top 0.18s ease,
      width 0.18s ease,
      height 0.18s ease;
  }

  .import-tour-card {
    position: fixed;
    z-index: 3002;
    pointer-events: auto;
    width: min(390px, calc(100vw - 36px));
    max-height: calc(100vh - 36px);
    overflow: auto;
    box-sizing: border-box;
    padding: 18px;
    border: 1px solid #b8d7d4;
    border-radius: 14px;
    background: #ffffff;
    box-shadow: 0 18px 42px rgba(8, 24, 28, 0.22);
    color: #12343b;
  }

  .import-tour-step-count {
    margin-bottom: 8px;
    color: #0f766e;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .import-tour-card h2 {
    margin: 0;
    color: #12343b;
    font-size: 22px;
    line-height: 1.25;
    font-weight: 850;
  }

  .import-tour-card p {
    margin: 10px 0 0;
    color: #526d73;
    font-size: 15px;
    line-height: 1.6;
  }

  .import-tour-note {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #eaf4f3;
    color: #27565c;
    font-size: 14px;
    line-height: 1.45;
    font-weight: 750;
  }

  .import-tour-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }

  @keyframes import-guide-attention-pulse {
    0%,
    100% {
      transform: translateY(0);
      box-shadow: 0 0 0 0 rgba(22, 119, 255, 0.42);
    }

    50% {
      transform: translateY(-1px);
      box-shadow: 0 0 0 7px rgba(22, 119, 255, 0.14);
    }
  }

  @keyframes import-guide-attention-ring {
    0%,
    100% {
      opacity: 0.55;
      transform: scale(0.98);
    }

    50% {
      opacity: 0.9;
      transform: scale(1.04);
    }
  }

  .overview-modal-content {
    display: grid;
    gap: 18px;
  }

  .overview-modal-copy {
    display: grid;
    gap: 8px;
  }

  .overview-modal-copy .section-kicker {
    margin: 0;
    color: #0f766e;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .overview-modal-copy h2 {
    margin: 0;
    color: #12343b;
    font-size: 26px;
    line-height: 1.2;
    font-weight: 850;
  }

  .overview-modal-copy p {
    margin: 0;
    color: #526d73;
    font-size: 15px;
    line-height: 1.58;
  }

  .overview-mission-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 8px;
  }

  .overview-mission-card {
    display: grid;
    gap: 6px;
    padding: 12px;
    border: 1px solid #d7eaec;
    border-radius: 12px;
    background: #f8fbfb;
  }

  .overview-mission-card span {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    background: #eaf4f3;
    color: #0f766e;
    font-size: 12px;
    font-weight: 900;
  }

  .overview-mission-card strong {
    color: #12343b;
    font-size: 14px;
    font-weight: 850;
  }

  .overview-mission-card p {
    margin: 0;
    color: #526d73;
    font-size: 13px;
    line-height: 1.45;
  }

  .overview-modal-feature {
    display: grid;
    gap: 12px;
  }

  .overview-modal-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .overview-modal-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 42px;
    padding: 8px 10px;
    border: 1px solid #d6e8e5;
    border-radius: 10px;
    background: #ffffff;
    color: #314b52;
    font-size: 13px;
    font-weight: 800;
    text-align: left;
    cursor: pointer;
  }

  .overview-modal-tab span {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: #eaf4f3;
    color: #0f766e;
    font-size: 12px;
    font-weight: 900;
  }

  .overview-modal-tab.active {
    border-color: #13a7b8;
    background: #eafafa;
  }

  .overview-modal-tab.active span {
    background: #0891b2;
    color: #ffffff;
  }

  .overview-modal-frame {
    height: 300px;
    border: 1px solid #d7eaec;
    border-radius: 12px;
    background: #eef5f6;
    overflow: hidden;
  }

  .overview-modal-frame img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
  }

  .overview-modal-frame img.overview-image-plan {
    object-fit: cover;
    object-position: 18% 58%;
  }

  .overview-modal-feature-copy {
    display: grid;
    gap: 5px;
    padding: 12px 14px;
    border: 1px solid #e0eef0;
    border-radius: 12px;
    background: #f8fbfb;
  }

  .overview-modal-feature-copy h3 {
    margin: 0;
    color: #12343b;
    font-size: 18px;
    font-weight: 850;
  }

  .overview-modal-feature-copy p {
    margin: 0;
    color: #526d73;
    font-size: 14px;
    line-height: 1.5;
  }

  .overview-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  @media (max-width: 1400px) {
    .workflow-steps {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 1100px) {
    .workflow-guide-header {
      align-items: stretch;
      flex-direction: column;
    }

    .intro-slide {
      grid-template-columns: minmax(0, 1fr);
    }

    .system-overview-hero {
      grid-template-columns: minmax(0, 1fr);
    }

    .system-overview-flow {
      grid-template-columns: minmax(0, 1fr);
    }

    .system-feature-tabs,
    .system-overview-card.feature-card {
      grid-template-columns: minmax(0, 1fr);
    }

    .screenshot-visual.large img {
      min-height: 320px;
    }

    .workflow-mode-card {
      min-width: 0;
    }
  }

  @media (max-width: 720px) {
    .intro-slide {
      min-height: auto;
    }

    .intro-illustration {
      min-height: 220px;
    }

    .convert-illustration {
      min-height: auto;
    }

    .convert-workspace-mock,
    .agent-stage {
      grid-template-columns: minmax(0, 1fr);
    }

    .convert-toolbar-mock {
      align-items: stretch;
      flex-direction: column;
    }

    .mock-button {
      width: 100%;
    }

    .convert-sidebar-mock {
      border-right: 0;
      border-bottom: 1px solid #cbd5e1;
    }

    .system-intro-actions {
      grid-template-columns: minmax(0, 1fr);
    }

    .system-intro-actions .ant-btn {
      width: 100%;
    }

    .workflow-steps {
      grid-template-columns: minmax(0, 1fr);
    }

    .input-mode-control {
      justify-items: start;
    }

    .author-footer {
      align-items: stretch;
      flex-direction: column;
    }
  }
}

.step-review {
  color: #1f2937;

  ::v-deep(.ant-card-body) {
    display: flex;
    flex-direction: column;
    gap: 24px;
    height: 100%;
  }

  .review-loading-panel {
    display: grid;
    place-items: center;
    min-height: 520px;
    height: 100%;
    padding: 28px;
  }

  .review-loading-card {
    width: min(920px, 100%);
    display: grid;
    gap: 18px;
    padding: 28px;
    border: 1px solid #cfe6ec;
    border-radius: 22px;
    background:
      radial-gradient(circle at top left, rgba(236, 254, 255, 0.9), transparent 34%),
      linear-gradient(135deg, #ffffff 0%, #f8fcff 100%);
    box-shadow: 0 18px 42px rgba(8, 145, 178, 0.1);
  }

  .review-loading-visual {
    position: relative;
    justify-self: center;
    width: 110px;
    height: 92px;
  }

  .loading-doc {
    position: absolute;
    left: 22px;
    top: 10px;
    width: 66px;
    height: 74px;
    border: 1px solid #bae6fd;
    border-radius: 14px;
    background:
      linear-gradient(#e0f2fe 0 0) 16px 18px / 34px 8px no-repeat,
      linear-gradient(#ccfbf1 0 0) 16px 34px / 44px 8px no-repeat,
      linear-gradient(#dbeafe 0 0) 16px 50px / 28px 8px no-repeat,
      #ffffff;
    box-shadow: 0 14px 30px rgba(15, 23, 42, 0.1);
  }

  .loading-spark {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #0891b2;
    animation: loadingPulse 1.35s ease-in-out infinite;
  }

  .loading-spark.one {
    left: 12px;
    top: 28px;
  }

  .loading-spark.two {
    right: 10px;
    top: 18px;
    animation-delay: 0.18s;
  }

  .loading-spark.three {
    right: 22px;
    bottom: 12px;
    animation-delay: 0.36s;
  }

  .review-loading-copy {
    display: grid;
    gap: 8px;
    text-align: center;
  }

  .review-loading-kicker {
    color: #0e7490;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .review-loading-copy h2 {
    margin: 0;
    color: #0f172a;
    font-size: 28px;
    line-height: 1.2;
    font-weight: 850;
  }

  .review-loading-copy p {
    justify-self: center;
    max-width: 700px;
    margin: 0;
    color: #475569;
    font-size: 15px;
    line-height: 1.6;
  }

  .review-loading-progress {
    max-width: 720px;
    width: 100%;
    justify-self: center;
  }

  .review-loading-steps {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .review-loading-step {
    display: grid;
    gap: 6px;
    align-content: start;
    min-height: 188px;
    padding: 14px;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    background: #ffffff;
  }

  .review-loading-step.active {
    border-color: #67e8f9;
    background: #ecfeff;
  }

  .review-loading-step.complete {
    border-color: #bbf7d0;
    background: #f7fef9;
  }

  .review-loading-step span {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: #0891b2;
    color: #ffffff;
    font-size: 13px;
    font-weight: 900;
  }

  .review-loading-step strong {
    color: #0f172a;
    font-size: 15px;
  }

  .review-loading-step small {
    color: #64748b;
    font-size: 13px;
    line-height: 1.45;
  }

  .loading-learning-note {
    display: grid;
    gap: 4px;
    margin-top: 8px;
    padding: 10px 11px;
    border: 1px solid rgba(14, 116, 144, 0.14);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.72);
  }

  .loading-learning-note b {
    color: #0f766e;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.03em;
  }

  .loading-learning-note p {
    margin: 0;
    color: #475569;
    font-size: 12px;
    line-height: 1.45;
  }

  .review-layout {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 16px;
    overflow: hidden;
  }

  .review-reviewer {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-height: 0;
  }

  .manual-review-guide {
    display: grid;
    gap: 6px;
    padding: 14px 16px;
    border: 1px dashed #c9d7eb;
    border-radius: 14px;
    background: #f8fbff;
  }

  .manual-review-guide-title {
    font-size: 16px;
    font-weight: 800;
    color: #153b7a;
  }

  .manual-review-guide-copy {
    font-size: 15px;
    line-height: 1.6;
    color: #53657f;
  }

  .plan-review-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 20px;
    align-items: stretch;
    padding: 22px 24px;
    border: 1px solid #cfe6ec;
    border-radius: 20px;
    background:
      radial-gradient(circle at top left, rgba(236, 254, 255, 0.9), transparent 34%),
      linear-gradient(135deg, #ffffff 0%, #f2fbfc 100%);
    box-shadow: 0 16px 32px rgba(8, 145, 178, 0.08);
  }

  .review-eyebrow {
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #0e7490;
  }

  .plan-review-title {
    margin: 0;
    font-size: 28px;
    line-height: 1.2;
    font-weight: 800;
    color: #164e63;
  }

  .plan-review-caption {
    margin: 8px 0 0;
    max-width: 900px;
    font-size: 16px;
    line-height: 1.6;
    color: #475569;
  }

  .plan-review-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(96px, 1fr));
    gap: 10px;
    min-width: 360px;
  }

  .plan-stat {
    display: grid;
    gap: 4px;
    align-content: center;
    justify-items: center;
    padding: 16px 14px;
    border: 1px solid #bae6fd;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.86);
  }

  .plan-stat-value {
    font-size: 30px;
    line-height: 1;
    font-weight: 800;
    color: #0891b2;
  }

  .plan-stat-label {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #64748b;
  }

  .ai-plan-panel,
  .route-summary-card {
    display: grid;
    gap: 16px;
    padding: 18px 20px;
    border: 1px solid #d6e7ea;
    border-radius: 18px;
    background: #ffffff;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
  }

  .ai-plan-panel-header,
  .route-summary-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .ai-plan-title,
  .route-summary-title,
  .review-navigation-title {
    margin: 0;
    font-size: 22px;
    line-height: 1.25;
    font-weight: 800;
    color: #164e63;
  }

  .ai-plan-caption,
  .route-summary-caption,
  .review-navigation-caption {
    margin: 4px 0 0;
    font-size: 15px;
    line-height: 1.55;
    color: #64748b;
  }

  .revision-preset-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .revision-preset-row.compact {
    gap: 8px;
  }

  .revision-preset {
    border: 1px solid #a5f3fc;
    border-radius: 999px;
    background: #ecfeff;
    color: #155e75;
    font-size: 14px;
    font-weight: 700;
    padding: 8px 12px;
    cursor: pointer;
    transition:
      border-color 0.18s ease,
      background-color 0.18s ease,
      color 0.18s ease;
  }

  .revision-preset:hover {
    border-color: #0891b2;
    background: #cffafe;
    color: #164e63;
  }

  .advanced-route-disclosure {
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: #ffffff;
  }

  .advanced-route-disclosure summary {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    color: #334155;
    cursor: pointer;
    list-style: none;
  }

  .advanced-route-disclosure summary::-webkit-details-marker {
    display: none;
  }

  .advanced-route-disclosure summary::before {
    content: '+';
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #f1f5f9;
    color: #0f766e;
    font-weight: 900;
    flex: 0 0 auto;
  }

  .advanced-route-disclosure[open] summary::before {
    content: '-';
  }

  .advanced-route-title {
    font-size: 15px;
    font-weight: 800;
    color: #0f172a;
  }

  .advanced-route-summary {
    color: #64748b;
    font-size: 14px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .advanced-route-disclosure .route-summary-card {
    margin: 0 12px 12px;
    box-shadow: none;
  }

  .route-entry-select {
    min-width: 280px;
    display: grid;
    gap: 8px;
    padding: 12px 14px;
    border: 1px solid #d6e7ea;
    border-radius: 14px;
    background: #f8feff;
  }

  .route-field-label {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
  }

  .route-issues {
    display: grid;
    gap: 8px;
    padding: 12px 14px;
    border: 1px solid #fed7aa;
    border-radius: 14px;
    background: #fff7ed;
    color: #9a3412;
  }

  .route-issues-title {
    font-size: 14px;
    font-weight: 800;
  }

  .route-issues ul {
    margin: 0;
    padding-left: 18px;
    font-size: 14px;
    line-height: 1.5;
  }

  .route-list {
    display: grid;
    gap: 12px;
  }

  .route-summary-item {
    display: grid;
    grid-template-columns: minmax(260px, 0.92fr) minmax(320px, 1.08fr);
    gap: 16px;
    padding: 16px;
    border: 1px solid #dbeafe;
    border-radius: 16px;
    background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  }

  .route-summary-item.active {
    border-color: #67e8f9;
    box-shadow: 0 0 0 3px rgba(8, 145, 178, 0.12);
  }

  .route-summary-item.branch {
    border-color: #bae6fd;
  }

  .route-summary-item.end {
    background: #f8fafc;
  }

  .route-summary-focus {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 12px;
    align-items: flex-start;
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .route-step-number {
    display: inline-grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: #0891b2;
    color: #ffffff;
    font-size: 18px;
    font-weight: 800;
  }

  .route-step-content {
    min-width: 0;
    display: grid;
    gap: 6px;
  }

  .route-step-title {
    font-size: 18px;
    line-height: 1.3;
    font-weight: 800;
    color: #0f172a;
    overflow-wrap: anywhere;
  }

  .route-entry-badge {
    display: inline-flex;
    margin-left: 8px;
    padding: 3px 8px;
    border-radius: 999px;
    background: #dcfce7;
    color: #166534;
    font-size: 12px;
    font-weight: 800;
    vertical-align: middle;
  }

  .route-step-description {
    font-size: 15px;
    line-height: 1.5;
    color: #475569;
  }

  .route-summary-controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .route-control-field,
  .branch-label-item {
    display: grid;
    gap: 8px;
  }

  .route-control-wide {
    grid-column: 1 / -1;
  }

  .route-field-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .route-link-action {
    border: 0;
    background: transparent;
    color: #0e7490;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
  }

  .route-link-action:hover {
    text-decoration: underline;
  }

  .branch-label-list {
    display: grid;
    gap: 10px;
    padding: 12px;
    border: 1px solid #e0f2fe;
    border-radius: 14px;
    background: #f8feff;
  }

  .branch-target {
    font-size: 14px;
    font-weight: 800;
    color: #164e63;
  }

  .route-end-note {
    padding: 12px 14px;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
    background: #f8fafc;
    color: #475569;
    font-size: 15px;
  }

  .route-canvas-card {
    display: grid;
    gap: 14px;
    padding: 16px 18px;
    border: 1px solid #d8e6fb;
    border-radius: 16px;
    background:
      radial-gradient(circle at top left, rgba(226, 238, 255, 0.75), transparent 34%),
      linear-gradient(180deg, #ffffff 0%, #eff5ff 100%);
    box-shadow: 0 16px 32px rgba(31, 79, 191, 0.08);
  }

  .route-canvas-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .route-canvas-toolbar {
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    gap: 14px;
    flex-wrap: wrap;
  }

  .route-canvas-title {
    margin: 0;
    font-size: 24px;
    font-weight: 800;
    letter-spacing: 0.01em;
    color: #11233f;
  }

  .route-canvas-caption {
    margin: 4px 0 0;
    max-width: 760px;
    font-size: 15px;
    line-height: 1.5;
    color: #5b687b;
  }

  .route-canvas-entry {
    min-width: 260px;
    display: grid;
    gap: 8px;
    padding: 12px 14px;
    border: 1px solid rgba(162, 186, 228, 0.66);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.8);
  }

  .route-canvas-field-label {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #607089;
  }

  .route-canvas-scroller {
    overflow: auto;
    padding-bottom: 4px;
    max-height: 720px;
  }

  .route-canvas {
    position: relative;
    min-width: 100%;
    min-height: 520px;
    border: 1px solid #d9e5f5;
    border-radius: 16px;
    background:
      linear-gradient(90deg, rgba(77, 130, 214, 0.03) 1px, transparent 1px),
      linear-gradient(rgba(77, 130, 214, 0.03) 1px, transparent 1px),
      linear-gradient(180deg, #fdfefe 0%, #f3f7ff 100%);
    background-size: 22px 22px, 22px 22px, 100% 100%;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
    cursor: grab;
  }

  .route-canvas.panning {
    cursor: grabbing;
  }

  .route-canvas-svg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .route-canvas-content {
    position: absolute;
    inset: 0 auto auto 0;
    transform-origin: top left;
  }

  .route-canvas-edge {
    fill: none;
    stroke: #7a96cf;
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.92;
  }

  .route-canvas-edge.branch {
    stroke: #ee8b3a;
  }

  .route-canvas-edge.end {
    stroke-dasharray: 7 7;
  }

  .route-canvas-node {
    position: absolute;
    display: grid;
    gap: 12px;
    padding: 16px;
    border: 1px solid #cfe0f7;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.94);
    box-shadow:
      0 10px 20px rgba(31, 79, 191, 0.08),
      0 1px 0 rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(3px);
  }

  .route-canvas-node.entry {
    border-color: #8cb0e8;
    background: linear-gradient(180deg, #ffffff 0%, #edf4ff 100%);
  }

  .route-canvas-node.branch {
    border-color: #f0c08f;
    background: linear-gradient(180deg, #fffdfa 0%, #fff4e7 100%);
  }

  .route-canvas-node.end {
    border-color: #d4ddeb;
    background: linear-gradient(180deg, #ffffff 0%, #f5f7fb 100%);
  }

  .route-canvas-node.active {
    border-color: #6d98e3;
    box-shadow:
      0 14px 28px rgba(31, 79, 191, 0.12),
      0 0 0 3px rgba(77, 130, 214, 0.12);
  }

  .route-node-focus {
    display: grid;
    gap: 4px;
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    text-align: left;
  }

  .route-node-headline {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .route-node-title-group {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
    flex-wrap: wrap;
    flex: 1;
  }

  .route-node-title {
    font-size: 22px;
    line-height: 1.18;
    font-weight: 800;
    color: #172033;
    flex: 1;
    min-width: 0;
  }

  .route-node-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 999px;
    background: #2d69db;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .route-node-summary {
    margin: 0;
    font-size: 15px;
    line-height: 1.48;
    color: #536173;
  }

  .route-node-drag-handle {
    border: 1px solid #d7e4f6;
    border-radius: 999px;
    background: linear-gradient(180deg, #ffffff 0%, #edf3ff 100%);
    color: #4564a7;
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    padding: 9px 12px;
    cursor: grab;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .route-node-drag-handle:hover {
    border-color: #afc5ec;
    color: #244d9f;
  }

  .route-node-drag-handle:active {
    cursor: grabbing;
  }

  .route-node-body {
    display: grid;
    gap: 10px;
  }

  .route-node-field {
    display: grid;
    gap: 10px;
  }

  .route-node-field-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .route-node-field-wide {
    grid-column: 1 / -1;
  }

  .route-node-clear {
    border: 0;
    background: transparent;
    color: #5070b4;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    padding: 0;
    white-space: nowrap;
  }

  .route-node-clear:hover {
    color: #2852af;
    text-decoration: underline;
  }

  .route-node-branch-list {
    display: grid;
    gap: 10px;
  }

  .route-node-branch-item {
    display: grid;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid #efe3d3;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.78);
  }

  .route-node-branch-target {
    font-size: 15px;
    font-weight: 700;
    color: #8a531d;
    overflow-wrap: anywhere;
  }

  .route-node-end-copy {
    padding: 10px 12px;
    border: 1px dashed #ccd6e4;
    border-radius: 12px;
    background: rgba(245, 247, 250, 0.75);
    font-size: 15px;
    line-height: 1.45;
    color: #5f6c7f;
    overflow-wrap: anywhere;
  }

  .route-node-title,
  .route-node-summary {
    overflow-wrap: anywhere;
  }

  .route-canvas-node {
    ::v-deep(.ant-select-selection-item),
    ::v-deep(.ant-select-selection-placeholder) {
      font-size: 14px;
      line-height: 1.4;
    }

    ::v-deep(.ant-select-selector),
    ::v-deep(.ant-input) {
      min-height: 40px;
      font-size: 14px;
    }
  }

  .route-canvas-zoom {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border: 1px solid rgba(162, 186, 228, 0.66);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.82);
  }

  .route-canvas-zoom-btn,
  .route-canvas-reset-btn {
    border: 1px solid #cbdaf2;
    border-radius: 10px;
    background: linear-gradient(180deg, #ffffff 0%, #edf4ff 100%);
    color: #274f9d;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
  }

  .route-canvas-zoom-btn {
    width: 40px;
    height: 40px;
    line-height: 1;
  }

  .route-canvas-reset-btn {
    padding: 9px 14px;
  }

  .route-canvas-zoom-value {
    min-width: 62px;
    text-align: center;
    font-size: 15px;
    font-weight: 700;
    color: #24427a;
  }

  .review-navigation {
    flex: 1.2;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 16px;
    background: #fff;
    overflow: auto;
    font-size: 17px;
  }

  .review-navigation-header {
    margin-bottom: 16px;
    padding-bottom: 14px;
    border-bottom: 1px solid #e2e8f0;
  }

  .topic-tree {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .topic-node {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .manual-topic-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 6px;
  }

  .topic-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 14px 16px;
    border: 1px solid #d8e2f2;
    background: linear-gradient(180deg, #fdfefe 0%, #f2f7ff 100%);
    border-radius: 14px;
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.04);
    cursor: pointer;
    text-align: left;
    font: inherit;
    font-size: 22px;
    font-weight: 700;
    color: #172033;
    letter-spacing: 0.01em;
    transition:
      background-color 0.18s ease,
      border-color 0.18s ease,
      box-shadow 0.18s ease,
      transform 0.18s ease;
  }

  .topic-button:hover {
    border-color: #b7c9e6;
    background: linear-gradient(180deg, #ffffff 0%, #edf4ff 100%);
    box-shadow: 0 10px 20px rgba(38, 72, 120, 0.08);
    transform: translateY(-1px);
  }

  .topic-button:focus {
    outline: none;
    border-color: #7fa6de;
    box-shadow: 0 0 0 3px rgba(77, 130, 214, 0.12);
  }

  .topic-button.active {
    border-color: #8fb4ea;
    background: linear-gradient(135deg, #edf4ff 0%, #dfeaff 100%);
    color: #1f4fbf;
    box-shadow: 0 12px 24px rgba(31, 79, 191, 0.1);
  }

  .topic-label {
    display: block;
    line-height: 1.25;
  }

  .topic-toggle-icon {
    display: flex;
    align-items: center;
    font-size: 18px;
  }

  .subtopic-list {
    margin: 0;
    padding: 2px 6px 0 12px;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .subtopic-item {
    width: 100%;
  }

  .subtopic-button {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid transparent;
    background: #f8fafc;
    border-radius: 10px;
    text-align: left;
    font: inherit;
    font-size: 17px;
    font-weight: 500;
    line-height: 1.45;
    color: #334155;
    cursor: pointer;
    transition:
      background-color 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease;
  }

  .subtopic-button:hover {
    border-color: #d7e0ea;
    background: #f1f5f9;
  }

  .subtopic-button.active {
    border-color: #c9d7f0;
    background: linear-gradient(180deg, #eef4ff 0%, #e7efff 100%);
    color: #2457d6;
    font-weight: 600;
  }

  .subtopic-empty {
    padding: 10px 14px;
    font-size: 15px;
    color: #999;
    border-radius: 10px;
    background: #fafafa;
  }

  .review-detail {
    flex: 2;
    border: 1px solid #dbe5f2;
    border-radius: 16px;
    padding: 18px;
    background: linear-gradient(180deg, #f7f9fc 0%, #eef3f9 100%);
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .detail-card {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 20px;
    border: 1px solid #d7e4f6;
    border-radius: 16px;
    background: linear-gradient(135deg, #ffffff 0%, #edf4ff 100%);
    box-shadow: 0 10px 24px rgba(34, 76, 140, 0.06);
  }

  .detail-title {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 0.01em;
  }

  .detail-header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .revision-disclosure {
    border: 1px solid #dbeafe;
    border-radius: 12px;
    background: #f8fbff;
  }

  .revision-disclosure summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 14px;
    color: #155e75;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    list-style: none;
  }

  .revision-disclosure summary::-webkit-details-marker {
    display: none;
  }

  .revision-disclosure summary::after {
    content: '+';
    display: inline-grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #ecfeff;
    color: #0891b2;
    font-weight: 900;
  }

  .revision-disclosure[open] summary::after {
    content: '-';
  }

  .revision-summary-hint {
    margin-left: auto;
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .topic-revision-disclosure {
    border-color: #bae6fd;
    background: #f0fdff;
  }

  .subtopic-revision-disclosure {
    margin-top: 4px;
  }

  .direction-editor {
    display: grid;
    gap: 8px;
    padding: 0 14px 14px;
    border-radius: 0 0 12px 12px;
  }

  .direction-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .topic-direction-editor {
    border: 0;
    background: transparent;

    ::v-deep(.ant-input) {
      background: #ffffff;
      border-color: #a5f3fc;
    }

    ::v-deep(.ant-input:hover),
    ::v-deep(.ant-input:focus) {
      border-color: #0891b2;
      box-shadow: 0 0 0 2px rgba(8, 145, 178, 0.12);
    }
  }

  .subtopic-direction-editor {
    border: 0;
    background: transparent;
  }

  .direction-label {
    font-size: 17px;
    font-weight: 600;
    color: #595959;
  }

  .direction-help {
    margin-top: 2px;
    font-size: 14px;
    line-height: 1.45;
    color: #64748b;
  }

  .detail-subtopics {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .subtopic-detail {
    display: grid;
    gap: 12px;
    border: 1px solid #dde7f3;
    border-radius: 14px;
    padding: 18px;
    background: linear-gradient(180deg, #ffffff 0%, #f7faff 100%);
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
  }

  .subtopic-title {
    margin: 0 0 8px 0;
    font-size: 21px;
    font-weight: 700;
  }

  .subtopic-brief {
    margin: 0 0 8px 0;
    font-size: 16px;
    line-height: 1.65;
    color: #1f1f1f;
  }

  .subtopic-brief.placeholder {
    color: #999;
    font-style: italic;
  }

  .subtopic-mi {
    display: flex;
    gap: 8px;
    font-size: 16px;
    line-height: 1.55;
    color: #1f1f1f;
  }

  .subtopic-mi .label {
    font-weight: 600;
  }

  .detail-empty {
    padding: 24px;
    border: 1px dashed #d9d9d9;
    border-radius: 8px;
    text-align: center;
    color: #999;
  }

  .review-reviewer {
    gap: 12px;
    overflow: hidden;
  }

  .plan-review-hero {
    display: grid;
    grid-template-columns: minmax(360px, 1fr) minmax(260px, auto) auto auto;
    align-items: center;
    gap: 14px;
    padding: 10px 14px;
    border-color: #dcecef;
    border-radius: 12px;
    background: #ffffff;
    box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);
  }

  .review-eyebrow {
    margin-bottom: 4px;
    font-size: 11px;
    color: #0f766e;
  }

  .plan-review-title {
    font-size: 19px;
    color: #12343b;
  }

  .plan-review-caption {
    max-width: 720px;
    font-size: 13px;
    line-height: 1.45;
    color: #5b6f75;
  }

  .plan-ai-mini {
    display: grid;
    gap: 2px;
    padding: 9px 12px;
    border: 1px solid #d8eeef;
    border-radius: 10px;
    background: #f4fbfb;
    color: #27565c;
  }

  .plan-ai-mini span {
    color: #0f766e;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .plan-ai-mini strong {
    max-width: 260px;
    font-size: 12px;
    line-height: 1.35;
  }

  .plan-review-stats {
    min-width: 224px;
    grid-template-columns: repeat(3, minmax(70px, 1fr));
    gap: 6px;
  }

  .plan-stat {
    padding: 8px 9px;
    border-radius: 10px;
    background: #f8fbfb;
    border-color: #dcecef;
  }

  .plan-stat-value {
    font-size: 20px;
    color: #0f766e;
  }

  .plan-stat-label {
    font-size: 10px;
  }

  .ai-plan-panel {
    display: grid;
    grid-template-columns: minmax(190px, 0.3fr) minmax(0, 1fr);
    gap: 12px;
    align-items: start;
    padding: 12px;
    border-color: #cfe9ec;
    border-radius: 12px;
    background:
      linear-gradient(90deg, rgba(236, 254, 255, 0.8), rgba(255, 255, 255, 0.95));
    box-shadow: 0 8px 20px rgba(15, 118, 110, 0.05);
  }

  .ai-plan-panel-header {
    display: grid;
    gap: 2px;
  }

  .ai-plan-title,
  .review-navigation-title {
    font-size: 17px;
    color: #12343b;
  }

  .ai-plan-caption,
  .review-navigation-caption {
    font-size: 12px;
  }

  .ai-command-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: stretch;
  }

  .ai-command-row ::v-deep(.ant-input) {
    min-height: 64px;
    border-color: #bde3e5;
    border-radius: 10px;
    background: #ffffff;
    font-size: 14px;
    line-height: 1.5;
  }

  .ai-command-row .ant-btn {
    align-self: stretch;
    min-width: 92px;
    height: auto;
    border-radius: 10px;
    font-weight: 800;
  }

  .ai-plan-panel .revision-preset-row {
    grid-column: 2;
    margin-top: -2px;
  }

  .revision-preset {
    padding: 6px 10px;
    font-size: 12px;
    border-color: #bdeff4;
    background: #f3fdfe;
  }

  .review-navigation {
    flex: 0 0 auto;
    width: 312px;
    min-width: 260px;
    max-width: 520px;
    padding: 12px 10px;
    border-color: #dce7ea;
    border-radius: 12px;
    background: #ffffff;
    font-size: 14px;
    resize: horizontal;
    overflow: auto;
  }

  .review-navigation-header {
    margin-bottom: 8px;
    padding-bottom: 8px;
  }

  .topic-tree {
    gap: 6px;
  }

  .topic-node {
    gap: 4px;
  }

  .topic-button {
    padding: 9px 10px;
    border-color: transparent;
    border-left: 3px solid transparent;
    border-radius: 9px;
    background: transparent;
    box-shadow: none;
    font-size: 14px;
    transform: none;
  }

  .topic-button:hover {
    border-color: #d9e2e6;
    border-left-color: #9fbfc4;
    background: #f5f8f9;
    box-shadow: none;
    transform: none;
  }

  .topic-button.active {
    border-color: #b8d7d4;
    border-left-color: #0f766e;
    background: #edf8f7;
    color: #12343b;
    box-shadow: none;
  }

  .subtopic-list {
    gap: 2px;
    margin-left: 12px;
    padding: 2px 0 2px 10px;
    border-left: 1px solid #dce7ea;
  }

  .subtopic-button {
    padding: 7px 9px;
    border-radius: 7px;
    background: transparent;
    font-size: 13px;
    color: #4a5f66;
  }

  .subtopic-button:hover {
    background: #f5f8f9;
  }

  .subtopic-button.active {
    border-color: transparent;
    background: #eaf4ff;
    color: #1d4f8f;
    font-weight: 700;
  }

  .review-detail {
    flex: 1 1 auto;
    padding: 14px;
    border-color: #dce7ea;
    border-radius: 12px;
    background: #f7fafb;
    gap: 12px;
  }

  .detail-card {
    gap: 12px;
  }

  .detail-header {
    padding: 12px 14px;
    border-color: #dce7ea;
    border-radius: 12px;
    background: #ffffff;
    box-shadow: none;
  }

  .detail-title {
    font-size: 22px;
    color: #12343b;
  }

  .subtopic-detail {
    gap: 10px;
    padding: 14px 16px;
    border-color: #dce7ea;
    border-radius: 12px;
    background: #ffffff;
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.035);
  }

  .subtopic-title {
    color: #172033;
    font-size: 19px;
  }

  .subtopic-brief {
    color: #334155;
    font-size: 15px;
    line-height: 1.6;
  }

  .subtopic-mi {
    display: inline-flex;
    width: fit-content;
    padding: 7px 10px;
    border: 1px solid #e3eef0;
    border-radius: 999px;
    background: #f8fbfb;
    color: #425d64;
    font-size: 13px;
  }

  .revision-disclosure {
    border-color: #d7edf0;
    border-radius: 10px;
    background: #f7fcfc;
  }

  .revision-disclosure summary {
    padding: 9px 11px;
    color: #0f766e;
  }

  .direction-editor {
    padding: 0 11px 11px;
  }

  .manual-empty-review {
    display: grid;
    gap: 14px;
    justify-items: center;
    padding: 40px 24px;
    border: 1px dashed #c9d7eb;
    border-radius: 18px;
    background: linear-gradient(180deg, #ffffff 0%, #f5f8fd 100%);
    text-align: center;
  }

  .review-footer {
    display: grid;
    gap: 16px;

    ::v-deep(.ant-input) {
      font-size: 16px;
      line-height: 1.6;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: flex-end;
    }
  }

  .manual-topic-editor {
    display: grid;
    gap: 18px;
  }

  .manual-topic-editor-alert {
    margin-bottom: 0;
  }

  .manual-topic-editor-subtopics {
    display: grid;
    gap: 14px;
  }

  .manual-topic-editor-subtopics-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .manual-topic-editor-subtopic {
    display: grid;
    gap: 12px;
    padding: 16px;
    border: 1px solid #dde7f3;
    border-radius: 14px;
    background: linear-gradient(180deg, #ffffff 0%, #f7faff 100%);
  }

  .manual-topic-editor-subtopic-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  @media (max-width: 960px) {
    .review-loading-card {
      padding: 20px;
    }

    .review-loading-steps {
      grid-template-columns: minmax(0, 1fr);
    }

    .plan-review-hero,
    .route-summary-item {
      grid-template-columns: minmax(0, 1fr);
    }

    .plan-review-stats {
      min-width: 0;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .route-summary-controls {
      grid-template-columns: minmax(0, 1fr);
    }

    .review-layout {
      flex-direction: column;
      overflow: visible;
    }

    .review-navigation,
    .review-detail {
      overflow: visible;
    }

    .routing-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .routing-branch-item {
      grid-template-columns: minmax(0, 1fr);
    }

    .detail-header {
      align-items: flex-start;
      flex-direction: column;
    }
  }
}

@keyframes loadingPulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.82);
  }

  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

.age-range {
  width: 100%;

  .divider {
    font-size: 15px;
    color: #777;
  }
}

.user-modal-desc {
  margin-bottom: 12px;
  color: #595959;
}

.user-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

:deep(.guide-attention-pulse.ant-btn) {
  position: relative;
  border-color: #1677ff;
  background: #1677ff;
  color: #ffffff;
  box-shadow: 0 0 0 0 rgba(22, 119, 255, 0.42);
  animation: planning-guide-attention-pulse 1s ease-in-out infinite;
}

:deep(.guide-attention-pulse.ant-btn::after) {
  position: absolute;
  inset: -7px;
  border: 2px solid rgba(22, 119, 255, 0.45);
  border-radius: 10px;
  content: '';
  animation: planning-guide-attention-ring 1s ease-in-out infinite;
}

:global(.planning-tour-overlay.import-tour-overlay) {
  position: fixed;
  inset: 0;
  z-index: 3000;
  pointer-events: none;
}

:global(.planning-tour-overlay .import-tour-highlight) {
  position: fixed;
  z-index: 3001;
  border: 3px solid #0f766e;
  border-radius: 12px;
  box-shadow:
    0 0 0 9999px rgba(8, 24, 28, 0.58),
    0 12px 32px rgba(15, 118, 110, 0.28);
  background: rgba(255, 255, 255, 0.04);
  pointer-events: none;
  transition:
    left 0.18s ease,
    top 0.18s ease,
    width 0.18s ease,
    height 0.18s ease;
}

:global(.planning-tour-overlay .import-tour-card) {
  position: fixed;
  z-index: 3002;
  pointer-events: auto;
  width: min(360px, calc(100vw - 36px));
  max-height: calc(100vh - 36px);
  overflow: auto;
  box-sizing: border-box;
  padding: 16px;
  border: 1px solid #b8d7d4;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 18px 42px rgba(8, 24, 28, 0.22);
  color: #12343b;
}

:global(.planning-tour-overlay .import-tour-step-count) {
  margin-bottom: 8px;
  color: #0f766e;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

:global(.planning-tour-overlay .import-tour-card h2) {
  margin: 0;
  color: #12343b;
  font-size: 20px;
  line-height: 1.25;
  font-weight: 850;
}

:global(.planning-tour-overlay .import-tour-card p) {
  margin: 8px 0 0;
  color: #526d73;
  font-size: 14px;
  line-height: 1.55;
}

:global(.planning-tour-overlay .import-tour-note) {
  margin-top: 10px;
  padding: 9px 10px;
  border-radius: 8px;
  background: #eaf4f3;
  color: #17494f;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 700;
}

:global(.planning-tour-overlay .import-tour-actions) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}

@keyframes planning-guide-attention-pulse {
  0%,
  100% {
    transform: translateY(0);
    box-shadow: 0 0 0 0 rgba(22, 119, 255, 0.42);
  }

  50% {
    transform: translateY(-1px);
    box-shadow: 0 0 0 7px rgba(22, 119, 255, 0.14);
  }
}

@keyframes planning-guide-attention-ring {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(0.98);
  }

  50% {
    opacity: 0.9;
    transform: scale(1.04);
  }
}

:global(.overview-modal .ant-modal-content) {
  border-radius: 16px;
  overflow: hidden;
}

:global(.overview-modal) {
  max-width: min(94vw, 1040px);
}

:global(.overview-modal .ant-modal-body) {
  max-height: min(88vh, 780px);
  overflow: auto;
  padding: 0;
}

:global(.overview-modal-content) {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  min-height: 520px;
  background: #ffffff;
}

:global(.overview-modal-main) {
  display: grid;
  align-content: start;
  gap: 18px;
  min-width: 0;
  padding: 30px 34px 24px;
}

:global(.overview-modal-copy) {
  display: grid;
  gap: 9px;
  max-width: 710px;
}

:global(.overview-modal-copy .section-kicker) {
  margin: 0;
  color: #0f766e;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

:global(.overview-modal-copy h2) {
  margin: 0;
  color: #12343b;
  font-size: clamp(24px, 2vw, 30px);
  line-height: 1.22;
  font-weight: 760;
  letter-spacing: 0;
}

:global(.overview-modal-copy p) {
  margin: 0;
  color: #526d73;
  font-size: 15px;
  line-height: 1.58;
}

:global(.overview-modal-copy strong),
:global(.overview-modal-feature-copy strong) {
  color: #12343b;
  font-weight: 680;
}

:global(.overview-modal-feature) {
  display: grid;
  gap: 12px;
  min-width: 0;
}

:global(.overview-modal-tabs) {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 24px 14px;
  border-right: 1px solid #d9e7e8;
  background: #f6fbfb;
}

:global(.overview-modal-tab) {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 54px;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #38545b;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease;
}

:global(.overview-modal-tab span) {
  min-width: 0;
}

:global(.overview-modal-tab > span:first-child) {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #e2f2f1;
  color: #0f766e;
  font-size: 12px;
  font-weight: 760;
}

:global(.overview-modal-tab-text) {
  display: grid;
  gap: 1px;
}

:global(.overview-modal-tab-text strong) {
  color: #12343b;
  font-size: 13px;
  line-height: 1.25;
  font-weight: 720;
}

:global(.overview-modal-tab-text small) {
  color: #6b858b;
  font-size: 11px;
  line-height: 1.25;
  font-weight: 600;
}

:global(.overview-modal-tab.active) {
  border-color: #98d5d0;
  background: #ffffff;
}

:global(.overview-modal-tab.active > span:first-child) {
  background: #0891b2;
  color: #ffffff;
}

:global(.overview-modal-frame) {
  height: min(300px, 35vh);
  border: 1px solid #d7eaec;
  border-radius: 10px;
  background: #eef5f6;
  overflow: hidden;
}

:global(.overview-modal-frame img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}

:global(.overview-modal-frame img.overview-image-plan) {
  object-fit: cover;
  object-position: 18% 58%;
}

:global(.overview-modal-feature-copy) {
  display: grid;
  gap: 7px;
  padding: 14px 16px;
  border: 1px solid #e0eef0;
  border-radius: 10px;
  background: #f8fbfb;
}

:global(.overview-modal-feature-copy h3) {
  margin: 0;
  color: #12343b;
  font-size: 18px;
  line-height: 1.3;
  font-weight: 740;
}

:global(.overview-modal-feature-copy p) {
  margin: 0;
  color: #526d73;
  font-size: 14px;
  line-height: 1.55;
}

:global(.overview-modal-actions) {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 2px;
}

:global(.overview-modal-actions .ant-btn) {
  min-height: 36px;
  padding-inline: 16px;
  font-size: 14px;
}

@media (max-width: 760px) {
  :global(.overview-modal .ant-modal-body) {
    max-height: 90vh;
  }

  :global(.overview-modal-content) {
    grid-template-columns: minmax(0, 1fr);
    min-height: 0;
  }

  :global(.overview-modal-tabs) {
    flex-direction: row;
    overflow-x: auto;
    padding: 14px;
    border-right: 0;
    border-bottom: 1px solid #d9e7e8;
  }

  :global(.overview-modal-tab) {
    flex: 0 0 164px;
  }

  :global(.overview-modal-main) {
    padding: 22px;
  }

  :global(.overview-modal-frame) {
    height: 220px;
  }

  :global(.overview-modal-copy h2) {
    font-size: 24px;
  }

  :global(.overview-modal-copy p),
  :global(.overview-modal-feature-copy p) {
    font-size: 15px;
  }
}
</style>
