export const DURATION = 14500
const clamp = value => Math.max(0, Math.min(1, value))
export function frameAt(ms) {
  const t = Math.max(0, Math.min(DURATION, ms))
  const userProgress = [1400,2300,3200].map(start=>clamp((t-start)/650))
  return {
    progress:t/DURATION, transition:clamp(t/1400), userProgress,
    userCount:userProgress.filter(value=>value>0).length,
    clusterProgress:clamp((t-4200)/2000), mirrorProgress:clamp((t-6500)/1400), faceProgress:clamp((t-8000)/1700),
    fusionOpacity:t<10000?1:1-clamp((t-10000)/1600),
    phase:t<1400?'changing':t<4200?'sensing':t<6500?'clustering':t<10000?'reconstructing':t<11600?'located':t<13200?'updating':'updated',
    localized:t>=10000, commit:t>=13200, done:t>=DURATION
  }
}
export const initialEnvironment = () => ({removed:false,added:false})
export function nextEnvironment(previous,type){return {...previous,[type==='obstacle_remove'?'removed':'added']:true}}
