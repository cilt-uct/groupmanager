package org.sakaiproject.groupmanager.tool.producers;

import org.sakaiproject.tool.api.ToolManager;

import uk.org.ponder.rsf.components.UIContainer;
import uk.org.ponder.rsf.components.UIOutput;
import uk.org.ponder.rsf.view.ComponentChecker;
import uk.org.ponder.rsf.view.DefaultView;
import uk.org.ponder.rsf.view.ViewComponentProducer;
import uk.org.ponder.rsf.viewstate.ViewParameters;

public class GroupManagerProducer implements ViewComponentProducer, DefaultView {
	
	public static final String VIEW_ID = "group-manager";
	public static final String NO_LOCATION = "noLocationAvailable";

	public String getViewID() {
		return VIEW_ID;
	}
	
	private ToolManager toolManager;
	public void setToolManager(ToolManager toolManager) {
		this.toolManager = toolManager;
	}
	public void fillComponents(UIContainer tofill, ViewParameters viewparams,
			ComponentChecker checker) {
		String currentSiteId = null;
		try {
			currentSiteId = toolManager.getCurrentPlacement().getContext();
		} catch (Exception e) {
			// sakai failed to get us a location so we can assume we are not
			// inside the portal
			currentSiteId = NO_LOCATION;
		}
		if (currentSiteId == null) {
			currentSiteId = NO_LOCATION;
		}
		UIOutput.make(tofill, "siteId", currentSiteId);
	}

}
