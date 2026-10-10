import { Component, lazy, Suspense, useState } from "react";
import { useProductLocale } from "./ProductLocale";

class FeatureBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function deferredFeature(loader) {
  return function DeferredProductFeature(props) {
    const { tx } = useProductLocale();
    const [{ attempt, Feature }, setFeature] = useState(() => ({
      attempt: 0,
      Feature: lazy(loader),
    }));
    return (
      <FeatureBoundary
        key={attempt}
        fallback={
          <div role="alert" className="product-card">
            <p>{tx("This page couldn’t be loaded.")}</p>
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setFeature(({ attempt }) => ({
                  attempt: attempt + 1,
                  Feature: lazy(loader),
                }))
              }
            >
              {tx("Try again")}
            </button>
          </div>
        }
      >
        <Suspense
          fallback={
            <div role="status" aria-busy="true">
              {tx("Opening your workspace…")}
            </div>
          }
        >
          <Feature {...props} />
        </Suspense>
      </FeatureBoundary>
    );
  };
}
