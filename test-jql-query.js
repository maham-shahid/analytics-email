// Old data (SDKs, Transformations, PortalPreviewed) Query

function main() {
  return join(
    Events({
      from_date: "2018-02-26",
      to_date: "2018-03-13",
      event_selectors: [
        {  
          "event":"EmbeddableDevPortalPreviewed"
        },
        {
          "event": "TransformViaWeb"
        },
        {
          "event": "TransformViaAPI"
        },
        {
          "event": "SDKGenerated_API"
        },
        {
          "event": "SDKGenerated_WEBSITE"
        },
        {
          "event": "SDKGenerated_WIDGET"
        },
        {
          "event": "SDKGenerated_AZURE"
        }
      ]
    }),
    People()
  )
  .filter(function(tuple) {
    return tuple.event && tuple.event.properties.$email == "mahum.shahid934+2@gmail.com";
  })
  .groupBy([
      "event.name"
    ], 
    mixpanel.reducer.count()
  );
}

// Transformation Events Query
function main() {
  return join(
    Events({
      from_date: "2018-02-26",
      to_date: "2018-03-13",
      event_selectors: [
        {
          "event": "TransformViaWeb"
        },
        {
          "event": "TransformViaAPI"
        }
      ]
    }),
    People()
  )
  .filter(function(tuple) {
    return tuple.event && tuple.event.properties.$email == "mahum.shahid934+2@gmail.com";
  })
  .reduce(mixpanel.reducer.count());
}

// DocsViewed & SDKsGen with languages Query
function main() {
  return join(
    Events({
      from_date: "2018-02-26",
      to_date: "2018-03-13",
      event_selectors: [
        {
          "event": "SDKGenerated_API"
        },
        {
          "event": "SDKGenerated_WEBSITE"
        },
        {
          "event": "SDKGenerated_WIDGET"
        },
        {
          "event": "SDKGenerated_AZURE"
        },
        {
          "event": "DocsViewed"
        }
      ]
    }),
    People()
  )
  .filter(function(tuple) {
    return tuple.event && tuple.event.properties.$email == "mahum.shahid934+2@gmail.com";
  });
}