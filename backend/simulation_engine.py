"""What-If simulation engine for scenario analysis"""
import numpy as np
from typing import Dict, List
import config
from yield_estimator import YieldEstimator
from cost_calculator import CostCalculator
from risk_engine import RiskEngine
from price_forecaster import PriceForecaster
from data_loader import DataLoader

class SimulationEngine:
    """Run Monte Carlo simulations for farming scenarios"""
    
    def __init__(self):
        self.yield_estimator = YieldEstimator()
        self.cost_calculator = CostCalculator()
        self.risk_engine = RiskEngine()
        self.price_forecaster = PriceForecaster()
        self.data_loader = DataLoader()
    
    def run_whatif_simulation(
        self,
        base_params: Dict,
        num_simulations: int = 500
    ) -> Dict:
        """
        Run multiple simulations with parameter variations
        Returns: Current Plan, AI Optimal Plan, Worst Case scenarios
        """
        # Run base scenario (farmer's current plan)
        current_plan = self._simulate_scenario(base_params, scenario_type="current")
        
        # Generate AI-optimized scenario
        optimal_params = self._optimize_parameters(base_params)
        optimal_plan = self._simulate_scenario(optimal_params, scenario_type="optimal")
        
        # Generate worst-case scenario
        worst_params = self._generate_worst_case(base_params)
        worst_plan = self._simulate_scenario(worst_params, scenario_type="worst")
        
        # Run Monte Carlo micro-simulations for uncertainty analysis
        micro_simulations = self._run_micro_simulations(base_params, num_simulations)
        
        return {
            "current_plan": current_plan,
            "ai_optimal_plan": optimal_plan,
            "worst_case_plan": worst_plan,
            "micro_simulations_summary": micro_simulations,
            "recommendation": self._generate_recommendation(current_plan, optimal_plan, worst_plan)
        }
    
    def _simulate_scenario(self, params: Dict, scenario_type: str) -> Dict:
        """Simulate a single farming scenario"""
        # Extract parameters
        crop = params["crop"]
        soil_type = params["soil_type"]
        area = params["area_hectares"]
        seed_quality = params["seed_quality"]
        rainfall = params["expected_rainfall"]
        rainfall_delay = params["rainfall_delay"]
        irrigation = params["irrigation_frequency"]
        fertilizer = params["fertilizer_mix"]
        pest_prob = params["pest_probability"]
        labour_days = params.get("labour_days", 30)
        pest_control = params.get("pest_control_intensity", 0.5)
        sale_month = params.get("sale_month", 3)
        current_price = params.get("current_market_price", 2000)
        
        # Estimate yield
        yield_result = self.yield_estimator.estimate_yield(
            crop, soil_type, seed_quality, rainfall, rainfall_delay,
            irrigation, fertilizer, pest_prob, area
        )
        
        # Calculate costs
        seed_qty = params.get("seed_quantity_kg", area * 50)
        cost_result = self.cost_calculator.calculate_cultivation_cost(
            crop, area, seed_qty, fertilizer, irrigation, rainfall,
            labour_days, pest_control, yield_result["total_production_quintals"]
        )
        
        # Forecast prices
        price_forecast = self.price_forecaster.forecast_prices(
            crop, current_price, forecast_days=60
        )
        
        # Estimate selling price based on sale month
        sale_day = min(59, sale_month * 15)  # Convert month to day (approx)
        expected_price = price_forecast["forecast_prices"][sale_day]
        
        # Calculate revenue and profit
        revenue = yield_result["total_production_quintals"] * expected_price
        profit = revenue - cost_result["total_cost"]
        roi = (profit / cost_result["total_cost"] * 100) if cost_result["total_cost"] > 0 else 0
        
        # Calculate risk
        price_stats = self.data_loader.get_price_statistics(crop)
        risk_result = self.risk_engine.calculate_risk_score(
            crop, soil_type, rainfall, rainfall_delay, pest_prob,
            price_stats, yield_result["confidence"]
        )
        
        return {
            "scenario_type": scenario_type,
            "yield": yield_result,
            "costs": cost_result,
            "price_forecast": price_forecast,
            "expected_selling_price": round(expected_price, 2),
            "revenue": round(revenue, 2),
            "profit": round(profit, 2),
            "roi_percentage": round(roi, 2),
            "risk": risk_result,
            "parameters_used": params
        }
    
    def _optimize_parameters(self, base_params: Dict) -> Dict:
        """Generate optimized parameters for better outcomes"""
        optimal = base_params.copy()
        
        # Optimize seed quality (increase to 0.85-0.95)
        optimal["seed_quality"] = min(0.95, base_params["seed_quality"] + 0.15)
        
        # Optimize irrigation (adjust based on rainfall)
        if base_params["expected_rainfall"] < 600:
            optimal["irrigation_frequency"] = base_params["irrigation_frequency"] + 2
        
        # Optimize fertilizer mix (balanced NPK)
        crop = base_params["crop"]
        optimal_npk = {
            "Rice": {"Urea": 150, "DAP": 80, "MOP": 60},
            "Wheat": {"Urea": 180, "DAP": 100, "MOP": 60},
            "Maize": {"Urea": 160, "DAP": 90, "MOP": 70},
        }
        if crop in optimal_npk:
            optimal["fertilizer_mix"] = optimal_npk[crop]
        
        # Reduce pest risk through better control
        optimal["pest_control_intensity"] = min(0.9, base_params.get("pest_control_intensity", 0.5) + 0.3)
        optimal["pest_probability"] = max(0.05, base_params["pest_probability"] - 0.15)
        
        # Optimize sale timing — target the typical mid-season window
        optimal["sale_month"] = 2
        
        return optimal
    
    def _generate_worst_case(self, base_params: Dict) -> Dict:
        """Generate worst-case scenario parameters
        
        Ensures worst case is ALWAYS worse than current plan by:
        - Degrading yield inputs (seed quality, rainfall, irrigation, fertilizer)
        - Increasing risk inputs (pest probability, less pest control)
        - Forcing lower selling price via market price depression
        - Poor sale timing
        """
        worst = base_params.copy()
        
        # Poor seed quality
        worst["seed_quality"] = max(0.3, base_params["seed_quality"] - 0.3)
        
        # Inadequate rainfall with delays
        worst["expected_rainfall"] = base_params["expected_rainfall"] * 0.6
        worst["rainfall_delay"] = base_params["rainfall_delay"] + 20
        
        # Reduced irrigation
        worst["irrigation_frequency"] = max(0, base_params["irrigation_frequency"] - 3)
        
        # Suboptimal fertilizer (40% reduction)
        worst["fertilizer_mix"] = {k: v * 0.5 for k, v in base_params["fertilizer_mix"].items()}
        
        # High pest risk
        worst["pest_probability"] = min(0.85, base_params["pest_probability"] + 0.35)
        worst["pest_control_intensity"] = max(0.1, base_params.get("pest_control_intensity", 0.5) - 0.35)
        
        # Depressed market price (15% below current) — simulates distress/glut selling
        worst["current_market_price"] = base_params.get("current_market_price", 2000) * 0.85
        
        # Worst sale timing — immediate distress sale
        worst["sale_month"] = 0
        
        # Increased labour costs (delays, rework)
        worst["labour_days"] = base_params.get("labour_days", 30) * 1.2
        
        return worst
    
    def _run_micro_simulations(self, base_params: Dict, num_sims: int) -> Dict:
        """Run multiple micro-simulations with random variations"""
        np.random.seed(42)
        
        profits = []
        yields = []
        risks = []
        
        for _ in range(num_sims):
            # Add random variations
            sim_params = base_params.copy()
            
            # Rainfall variation (±20%)
            rainfall_var = np.random.uniform(-0.2, 0.2)
            sim_params["expected_rainfall"] = base_params["expected_rainfall"] * (1 + rainfall_var)
            
            # Pest probability variation (0-30%)
            sim_params["pest_probability"] = np.random.uniform(0, 0.3)
            
            # Fertilizer variation (±15%)
            fert_var = np.random.uniform(0.85, 1.15)
            sim_params["fertilizer_mix"] = {
                k: v * fert_var for k, v in base_params["fertilizer_mix"].items()
            }
            
            # Price variation (±10%)
            price_var = np.random.uniform(0.9, 1.1)
            sim_params["current_market_price"] = base_params.get("current_market_price", 2000) * price_var
            
            # Run simulation
            result = self._simulate_scenario(sim_params, "micro")
            
            profits.append(result["profit"])
            yields.append(result["yield"]["yield_per_hectare"])
            risks.append(result["risk"]["overall_risk_score"])
        
        return {
            "num_simulations": num_sims,
            "profit_stats": {
                "mean": round(np.mean(profits), 2),
                "std": round(np.std(profits), 2),
                "min": round(np.min(profits), 2),
                "max": round(np.max(profits), 2),
                "percentile_25": round(np.percentile(profits, 25), 2),
                "percentile_75": round(np.percentile(profits, 75), 2)
            },
            "yield_stats": {
                "mean": round(np.mean(yields), 2),
                "std": round(np.std(yields), 2),
                "min": round(np.min(yields), 2),
                "max": round(np.max(yields), 2)
            },
            "risk_stats": {
                "mean": round(np.mean(risks), 2),
                "std": round(np.std(risks), 2)
            },
            "probability_of_profit": round(sum(1 for p in profits if p > 0) / len(profits) * 100, 2)
        }
    
    def _generate_recommendation(self, current: Dict, optimal: Dict, worst: Dict) -> str:
        """Generate natural language recommendation"""
        profit_improvement = optimal["profit"] - current["profit"]
        risk_reduction = current["risk"]["overall_risk_score"] - optimal["risk"]["overall_risk_score"]
        
        recommendation = f"🌾 **AI-Powered Farming Strategy Recommendation**\n\n"
        
        if profit_improvement > 0:
            improvement_pct = (profit_improvement / max(abs(current["profit"]), 1)) * 100
            recommendation += f"✅ By adopting the AI-optimized strategy, you can increase profit by ₹{profit_improvement:,.2f} ({improvement_pct:.1f}% improvement).\n\n"
        
        if risk_reduction > 0:
            recommendation += f"🛡️ The optimized plan reduces your risk score by {risk_reduction:.1f} points, making your farming more stable.\n\n"
        
        recommendation += "**Key Recommendations:**\n"
        
        # Seed quality
        if optimal["parameters_used"]["seed_quality"] > current["parameters_used"]["seed_quality"]:
            recommendation += "• Invest in higher quality seeds for better yields\n"
        
        # Irrigation
        if optimal["parameters_used"]["irrigation_frequency"] > current["parameters_used"]["irrigation_frequency"]:
            recommendation += "• Increase irrigation frequency to compensate for rainfall uncertainty\n"
        
        # Fertilizer
        recommendation += "• Optimize fertilizer mix for balanced NPK nutrition\n"
        
        # Pest control
        if optimal["parameters_used"]["pest_control_intensity"] > current["parameters_used"].get("pest_control_intensity", 0.5):
            recommendation += "• Strengthen pest management to protect yield\n"
        
        # Sale timing
        selling_day = optimal["price_forecast"]["optimal_selling_window"]["recommended_day"]
        recommendation += f"• Plan to sell around day {selling_day} for maximum price\n"
        
        return recommendation
