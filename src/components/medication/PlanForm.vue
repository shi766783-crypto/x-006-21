<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useFamilyStore } from '../../stores/useFamilyStore'
import type { MedicationPlan, PlanInput } from '../../types'
import { planEditImpact } from '../../utils/plan'

const props = defineProps<{ plan?: MedicationPlan | null }>()
const emit = defineEmits<{
  (e: 'save', data: PlanInput): void
  (e: 'close'): void
}>()

const store = useFamilyStore()
const isEdit = computed(() => !!props.plan)

const form = reactive({
  memberId: props.plan?.memberId ?? store.state.members[0]?.id ?? '',
  medicineId: props.plan?.medicineId ?? store.state.medicines[0]?.id ?? '',
  dosage: props.plan?.dosage ?? '',
  times: props.plan?.times?.length ? [...props.plan.times] : ['08:00'],
  startDate: props.plan?.startDate ?? '',
  endDate: props.plan?.endDate ?? '',
})

function addTime() {
  form.times.push('12:00')
}

function removeTime(index: number) {
  form.times.splice(index, 1)
}

const error = computed(() => {
  if (!isEdit.value) {
    if (!form.memberId) return '请选择家庭成员'
    if (!form.medicineId) return '请选择药品'
  }
  if (!form.times.length || form.times.some((t) => !t)) return '请至少设置一个服药时间点'
  if (form.startDate && form.endDate && form.endDate < form.startDate) {
    return '结束日期不能早于开始日期'
  }
  return ''
})

/** What editing does to today's already-recorded doses (edit mode only). */
const impact = computed(() => {
  if (!props.plan) return null
  return planEditImpact(props.plan, {
    memberId: form.memberId,
    medicineId: form.medicineId,
    dosage: form.dosage.trim(),
    times: [...form.times].sort(),
    startDate: form.startDate,
    endDate: form.endDate,
  }, store.state.logs)
})

function submit() {
  if (error.value) return
  emit('save', {
    memberId: form.memberId,
    medicineId: form.medicineId,
    dosage: form.dosage.trim(),
    times: [...form.times].sort(),
    startDate: form.startDate,
    endDate: form.endDate,
  })
}
</script>

<template>
  <div class="form-grid">
    <div class="form-group">
      <label class="form-label">家庭成员 *</label>
      <select v-model="form.memberId" class="input" :disabled="isEdit">
        <option v-for="m in store.state.members" :key="m.id" :value="m.id">{{ m.name }}</option>
      </select>
      <span v-if="isEdit" class="field-hint">编辑时不可更换，需更换请删除后新建</span>
    </div>
    <div class="form-group">
      <label class="form-label">药品 *</label>
      <select v-model="form.medicineId" class="input" :disabled="isEdit">
        <option v-for="m in store.state.medicines" :key="m.id" :value="m.id">{{ m.name }}</option>
      </select>
      <span v-if="isEdit" class="field-hint">编辑时不可更换，需更换请删除后新建</span>
    </div>
    <div class="form-group">
      <label class="form-label">每次剂量</label>
      <input v-model="form.dosage" class="input" placeholder="如：1粒 / 5ml" />
    </div>
    <div class="form-group">
      <label class="form-label">开始日期</label>
      <input v-model="form.startDate" type="date" class="input" />
    </div>
    <div class="form-group">
      <label class="form-label">结束日期</label>
      <input v-model="form.endDate" type="date" class="input" />
    </div>
    <div class="form-group span-2">
      <label class="form-label">每日服药时间</label>
      <div class="time-list">
        <div v-for="(time, i) in form.times" :key="time + i" class="time-row">
          <input v-model="form.times[i]" type="time" class="input" />
          <button
            type="button"
            class="btn btn-sm btn-ghost"
            :disabled="form.times.length <= 1"
            @click="removeTime(i)"
          >
            移除
          </button>
        </div>
        <button type="button" class="btn btn-sm btn-ghost" @click="addTime">+ 添加时间点</button>
      </div>
    </div>
  </div>

  <!-- Edit-mode guidance: how existing medication records are kept -->
  <div v-if="isEdit" class="edit-notice">
    <div class="notice-title">📋 已有服药记录的处理方式</div>
    <ul>
      <li>修改<b>剂量</b>：只影响之后的待服提示，历史服药记录原样保留。</li>
      <li>保留的时间点：今天已标记的「已服用 / 已跳过」状态不变。</li>
      <li>删除或改动的时间点：今天对应的服药记录会保留在历史记录与依从率统计中，只是不再出现在今日待服列表；不会被删除。</li>
      <li>新增的时间点：若在起止日期内，今天起作为新的待服项出现。</li>
    </ul>
    <div v-if="impact && (impact.removed.length || impact.added.length)" class="notice-impact">
      <template v-if="impact.removed.length">
        <div>
          本次将移走今日时间点
          <b>{{ impact.removed.join('、') }}</b>
          <template v-if="impact.loggedRemoved.length">
            ，其中 {{ impact.loggedRemoved.length }} 条今日服药记录保留在历史中、不再显示
          </template>
        </div>
      </template>
      <div v-if="impact.added.length">
        本次将新增今日时间点 <b>{{ impact.added.join('、') }}</b>，作为待服项出现。
      </div>
    </div>
  </div>

  <div v-if="error" class="form-error">{{ error }}</div>

  <div class="form-actions">
    <button type="button" class="btn btn-ghost" @click="emit('close')">取消</button>
    <button type="button" class="btn btn-primary" :disabled="!!error" @click="submit">保存</button>
  </div>
</template>

<style scoped>
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
.time-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.time-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.field-hint {
  font-size: 12px;
  color: var(--text-secondary);
}
.form-error {
  margin-top: 12px;
  font-size: 13px;
  color: var(--danger-color);
}
.edit-notice {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--accent-bg);
  border: 1px solid rgba(66, 185, 131, 0.3);
  font-size: 13px;
  color: var(--text-primary);
}
.notice-title {
  font-weight: 600;
  margin-bottom: 6px;
}
.edit-notice ul {
  margin: 0 0 0 18px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--text-secondary);
}
.notice-impact {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed rgba(66, 185, 131, 0.4);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
