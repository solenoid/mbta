import { render, Component, h } from "./web_modules/preact.js";
import htm from "./web_modules/htm.js";
// - https://www.pikapkg.com/blog/pika-web-a-future-without-webpack#pika-web-web-apps-without-the-bundler
// - https://www.npmjs.com/package/htm
const html = htm.bind(h);
class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      routes: [],
      routesWithStops: [],
      multiRouteStops: [],
      maxStops: NaN,
      minStops: NaN
    };
  }
  componentDidMount() {
    fetch("https://api-v3.mbta.com/routes?filter%5Btype%5D=0,1")
      .then(d => d.json())
      .then(d => {
        const routes = d.data.map(r => {
          r.stops = [];
          return r;
        });
        this.setState({ routes });
        // TODO see if there is a better way to get stops instead of
        //      fanning out a fetch promise for each route
        const stopPromises = routes
          .map(r => r.id)
          .map(id =>
            fetch("https://api-v3.mbta.com/stops?filter%5Broute%5D=" + id)
              .then(d => d.json())
              .then(d => d.data)
          );
        Promise.all(stopPromises)
          .then(d => {
            const routesWithStops = routes.map((r, i) => {
              r.stops = d[i];
              r.stopCount = d[i].length;
              return r;
            });
            const stopCounts = routesWithStops.map(r => r.stopCount);
            const maxStops = Math.max(...stopCounts);
            const minStops = Math.min(...stopCounts);
            this.setState({ routesWithStops, maxStops, minStops });
            const stopIndexed = routesWithStops.reduce((memo, r) => {
              r.stops.forEach(s => {
                // assume names are unique if not use ids instead
                const stopKey = s.attributes.name;
                memo[stopKey] = memo[stopKey] || [];
                memo[stopKey].push(r.attributes.long_name);
              });
              return memo;
            }, {});
            const multiRouteStops = Object.entries(stopIndexed).filter(
              ([e, v]) => v.length > 1
            );
            this.setState({ multiRouteStops });
          })
          .catch(e => {
            console.error("fetch stops problem");
            console.error(e);
          });
      })
      .catch(e => {
        console.error("fetch routes problem");
        console.error(e);
      });
  }
  render(_, { routes, routesWithStops, maxStops, minStops, multiRouteStops }) {
    return html`
      <div class="main">
        <section>
          <h1>Problem 1)</h1>
          <ol>
            ${routes.map(
              r => html`
                <li key=${r.id}>${r.attributes.long_name}</li>
              `
            )}
          </ol>
        </section>
        <section>
          <h1>Problem 2)</h1>
          <h2>a) Most Stops</h2>
          ${routesWithStops
            .filter(r => r.stopCount === maxStops)
            .map(
              r =>
                html`
                  <div>${r.attributes.long_name}</div>
                `
            )}
          <h2>b) Fewest Stops</h2>
          ${routesWithStops
            .filter(r => r.stopCount === minStops)
            .map(
              r =>
                html`
                  <div>${r.attributes.long_name}</div>
                `
            )}
          <h2>c) Multiple Routes</h2>
          ${multiRouteStops.map(
            ([s, rs]) =>
              html`
                <h3>${s} Stop is on these Routes</h3>
                <p>${rs.join(", ")}</p>
              `
          )}
        </section>
      </div>
    `;
  }
}

render(
  html`
    <${App} />
  `,
  document.getElementById("app")
);
