import React, {Component, lazy, Suspense, useState} from 'react';
import {useTranslation} from '../i18n';

class FeatureBoundary extends Component {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

// A new lazy instance on retry clears React's cached rejected import promise.
export const deferredFeature = loader => {
  function DeferredFeature(props) {
    const {t} = useTranslation();
    const [{attempt,Feature},setFeature] = useState(() => ({attempt:0,Feature:lazy(loader)}));
    return <FeatureBoundary key={attempt} fallback={
      <div role="alert" className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <p>{t('common.error')}</p>
        <button type="button" className="rounded-lg bg-green-700 px-4 py-2 text-white" onClick={()=>setFeature(value=>({attempt:value.attempt+1,Feature:lazy(loader)}))}>{t('common.retry')}</button>
      </div>
    }>
      <Suspense fallback={<div role="status" aria-busy="true" className="p-4 text-gray-600">{t('common.loading')}</div>}>
        <Feature {...props}/>
      </Suspense>
    </FeatureBoundary>;
  }
  return DeferredFeature;
};
