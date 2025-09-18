import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Award, 
  Clock, 
  User, 
  Car, 
  BarChart3,
  Search,
  Filter,
  Medal,
  Target,
  Activity,
  AlertTriangle,
  CheckCircle,
  Zap,
  Shield,
  Download,
  RefreshCw,
  Users,
  Eye,
  Calendar,
  MapPin
} from "lucide-react";

interface DriverEvaluation {
  driverId: string;
  driverName: string;
  nomorLambung: string;
  department: string;
  investorGroup: string;
  evaluationPeriod: {
    startDate: string;
    endDate: string;
    totalDays: number;
  };
  metrics: {
    attendanceRate: number;
    punctualityScore: number;
    sleepQualityIndex: number;
    fitToWorkCompliance: number;
    overallScore: number;
  };
  attendanceRate: number;
  punctualityScore: number;
  sleepQualityIndex: number;
  fitToWorkCompliance: number;
  overallScore: number;
  statistics: {
    totalScheduledDays: number;
    totalAttendedDays: number;
    totalLeaveDays: number;
    expectedWorkDays: number;
    averageSleepHours: number;
  };
  trends: {
    lastWeekAttendances: number;
    previousWeekAttendances: number;
    trend: 'improving' | 'declining' | 'stable';
  };
  lastActivity: string | null;
}

interface DriverRanking {
  id: string;
  name: string;
  nomorLambung: string;
  department: string;
  investorGroup: string;
  overallScore: number;
  attendanceRate: number;
  punctualityScore: number;
  sleepQualityIndex: number;
  fitToWorkCompliance: number;
  rank: number;
}

export default function DriverEvaluation() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterInvestorGroup, setFilterInvestorGroup] = useState("all");
  const [selectedDriver, setSelectedDriver] = useState<DriverEvaluation | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const { toast } = useToast();

  // Fetch driver evaluations
  const { data: drivers, isLoading: driversLoading, refetch: refetchDrivers } = useQuery<DriverEvaluation[]>({
    queryKey: ["/api/evaluations/drivers"],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch driver rankings
  const { data: rankings, isLoading: rankingsLoading } = useQuery<DriverRanking[]>({
    queryKey: ["/api/evaluations/rankings"],
    refetchInterval: 30000,
  });

  // Filter drivers based on search and filters
  const filteredDrivers = drivers?.filter(driver => {
    const matchesSearch = driver.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         driver.nomorLambung?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         driver.driverId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = filterDepartment === "all" || driver.department === filterDepartment;
    const matchesInvestorGroup = filterInvestorGroup === "all" || driver.investorGroup === filterInvestorGroup;
    
    return matchesSearch && matchesDepartment && matchesInvestorGroup;
  }) || [];

  // Get unique departments and investor groups for filters
  const departments = [...new Set(drivers?.map(d => d.department).filter(Boolean))] || [];
  const investorGroups = [...new Set(drivers?.map(d => d.investorGroup).filter(Boolean))] || [];

  // Performance color coding
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 dark:text-green-400";
    if (score >= 80) return "text-blue-600 dark:text-blue-400";
    if (score >= 70) return "text-yellow-600 dark:text-yellow-400";
    if (score >= 60) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 90) return "bg-green-500 text-white";
    if (score >= 80) return "bg-blue-500 text-white";
    if (score >= 70) return "bg-yellow-500 text-white";
    if (score >= 60) return "bg-orange-500 text-white";
    return "bg-red-500 text-white";
  };

  const getPerformanceLevel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Good";
    if (score >= 70) return "Average";
    if (score >= 60) return "Below Average";
    return "Poor";
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'declining': return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  // Calculate summary statistics
  const totalDrivers = drivers?.length || 0;
  const averageScore = totalDrivers > 0 ? Math.round(drivers!.reduce((sum, d) => sum + d.overallScore, 0) / totalDrivers) : 0;
  const excellentDrivers = drivers?.filter(d => d.overallScore >= 90).length || 0;
  const needsAttentionDrivers = drivers?.filter(d => d.overallScore < 70).length || 0;

  return (
    <div className="space-y-8">
      {/* Hero Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 text-white p-8 md:p-12">
        <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-white/10 opacity-30"></div>
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between space-y-6 lg:space-y-0">
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Award className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white mb-2">
                    Driver Performance Evaluation
                  </h1>
                  <p className="text-lg text-white/90 font-medium">
                    Comprehensive performance analysis and driver ranking system
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                  <Users className="w-4 h-4" />
                  <span>{totalDrivers} Active Drivers</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                  <BarChart3 className="w-4 h-4" />
                  <span>{averageScore}% Average Score</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                  <Medal className="w-4 h-4" />
                  <span>{excellentDrivers} Excellent Performers</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{needsAttentionDrivers} Need Attention</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => refetchDrivers()} 
                variant="secondary" 
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                data-testid="refresh-evaluations-button"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Data
              </Button>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-green-200" />
                  <span>Last 30 Days Analysis</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-700 rounded-2xl border border-gray-100 dark:border-gray-600 p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by name, NIK, or vehicle number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                data-testid="search-drivers-input"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-48 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterInvestorGroup} onValueChange={setFilterInvestorGroup}>
              <SelectTrigger className="w-48 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Investor Groups</SelectItem>
                {investorGroups.map(group => (
                  <SelectItem key={group} value={group}>{group}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Driver Performance Cards Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Driver Performance Overview</h2>
          <Badge variant="outline" className="text-sm">
            {filteredDrivers.length} drivers showing
          </Badge>
        </div>

        {driversLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">Loading driver evaluations...</p>
          </div>
        ) : filteredDrivers.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredDrivers.map((driver) => (
              <Card key={driver.driverId} className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-all duration-300 cursor-pointer group"
                onClick={() => { setSelectedDriver(driver); setIsDetailsOpen(true); }}
                data-testid={`driver-card-${driver.driverId}`}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                        {driver.driverName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-lg font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {driver.driverName}
                        </CardTitle>
                        <div className="flex flex-col space-y-1 mt-1">
                          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                            <User className="w-3 h-3 mr-1" />
                            {driver.driverId}
                          </p>
                          {driver.nomorLambung && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                              <Car className="w-3 h-3 mr-1" />
                              {driver.nomorLambung}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <Badge className={`${getScoreBadgeVariant(driver.overallScore)} font-bold`}>
                        {driver.overallScore}%
                      </Badge>
                      <div className="flex items-center">
                        {getTrendIcon(driver.trends.trend)}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Performance Metrics */}
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Attendance Rate</span>
                        <span className={`text-xs font-bold ${getScoreColor(driver.attendanceRate)}`}>
                          {driver.attendanceRate}%
                        </span>
                      </div>
                      <Progress value={driver.attendanceRate} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Punctuality</span>
                        <span className={`text-xs font-bold ${getScoreColor(driver.punctualityScore)}`}>
                          {driver.punctualityScore}%
                        </span>
                      </div>
                      <Progress value={driver.punctualityScore} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Sleep Quality</span>
                        <span className={`text-xs font-bold ${getScoreColor(driver.sleepQualityIndex)}`}>
                          {driver.sleepQualityIndex}%
                        </span>
                      </div>
                      <Progress value={driver.sleepQualityIndex} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Fit to Work</span>
                        <span className={`text-xs font-bold ${getScoreColor(driver.fitToWorkCompliance)}`}>
                          {driver.fitToWorkCompliance}%
                        </span>
                      </div>
                      <Progress value={driver.fitToWorkCompliance} className="h-2" />
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-600">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Work Days</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {driver.statistics.totalAttendedDays}/{driver.statistics.expectedWorkDays}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Avg Sleep</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {driver.statistics.averageSleepHours}h
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Level</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {getPerformanceLevel(driver.overallScore)}
                      </p>
                    </div>
                  </div>

                  {/* Department and Investor Group */}
                  <div className="flex gap-2 pt-2">
                    <Badge variant="secondary" className="text-xs">
                      {driver.department}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {driver.investorGroup}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No drivers found</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Try adjusting your search criteria or filters
            </p>
          </div>
        )}
      </div>

      {/* Driver Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                {selectedDriver?.driverName.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-bold">{selectedDriver?.driverName}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                  {selectedDriver?.driverId} • {selectedDriver?.nomorLambung}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedDriver && (
            <div className="space-y-6">
              {/* Performance Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="text-center">
                  <CardContent className="pt-6">
                    <div className={`text-2xl font-bold ${getScoreColor(selectedDriver.overallScore)}`}>
                      {selectedDriver.overallScore}%
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Overall Score</p>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="pt-6">
                    <div className={`text-2xl font-bold ${getScoreColor(selectedDriver.attendanceRate)}`}>
                      {selectedDriver.attendanceRate}%
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Attendance</p>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="pt-6">
                    <div className={`text-2xl font-bold ${getScoreColor(selectedDriver.punctualityScore)}`}>
                      {selectedDriver.punctualityScore}%
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Punctuality</p>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="pt-6">
                    <div className={`text-2xl font-bold ${getScoreColor(selectedDriver.sleepQualityIndex)}`}>
                      {selectedDriver.sleepQualityIndex}%
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Sleep Quality</p>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Performance Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Scheduled Days</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedDriver.statistics.totalScheduledDays}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Attended Days</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedDriver.statistics.totalAttendedDays}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Leave Days</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedDriver.statistics.totalLeaveDays}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Average Sleep Hours</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedDriver.statistics.averageSleepHours}h
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Trends */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Performance Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Last Week Attendances</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedDriver.trends.lastWeekAttendances}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getTrendIcon(selectedDriver.trends.trend)}
                      <span className="text-sm font-medium capitalize">
                        {selectedDriver.trends.trend}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Previous Week</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedDriver.trends.previousWeekAttendances}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Evaluation Period */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    Evaluation Period
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Start Date</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedDriver.evaluationPeriod.startDate}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">End Date</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedDriver.evaluationPeriod.endDate}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Days</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedDriver.evaluationPeriod.totalDays}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}